package inventory

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrProductNotFound     = errors.New("product not found")
	ErrInsufficientStock   = errors.New("insufficient stock for requested operation")
	ErrIdempotencyConflict = errors.New("idempotency key was previously used with a different request payload")
	ErrInvalidQuantity     = errors.New("quantity must be greater than zero")
)

type Repository interface {
	AdjustStock(ctx context.Context, productID uuid.UUID, moveType MovementType, req StockAdjustmentRequest) (*StockAdjustmentResult, error)
	ListMovements(ctx context.Context, q ListMovementsQuery) ([]StockMovement, int64, error)
	GetMovementsByProduct(ctx context.Context, productID uuid.UUID, page, pageSize int) ([]StockMovement, int64, error)
}

type pgxRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgxRepository{pool: pool}
}

func (r *pgxRepository) AdjustStock(ctx context.Context, productID uuid.UUID, moveType MovementType, req StockAdjustmentRequest) (*StockAdjustmentResult, error) {
	if req.Quantity <= 0 {
		return nil, ErrInvalidQuantity
	}
	idempKey := strings.TrimSpace(req.IdempotencyKey)
	if idempKey == "" {
		return nil, errors.New("idempotency key is required")
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Step 2: Handle Idempotency Key Atomically
	var existing StockMovement
	var existingType string
	err = tx.QueryRow(ctx, `
		SELECT id, product_id, type, quantity, note, idempotency_key, created_at
		FROM stock_movements
		WHERE idempotency_key = $1
	`, idempKey).Scan(
		&existing.ID,
		&existing.ProductID,
		&existingType,
		&existing.Quantity,
		&existing.Note,
		&existing.IdempotencyKey,
		&existing.CreatedAt,
	)

	if err == nil {
		existing.Type = MovementType(existingType)
		// Found existing movement with this idempotency key.
		// Check if payload matches
		if existing.ProductID == productID && existing.Type == moveType && existing.Quantity == req.Quantity {
			// Idempotent match! Fetch product details and current stock
			var curStock int
			var prodName, prodSKU string
			prodErr := tx.QueryRow(ctx, "SELECT name, sku, stock_quantity FROM products WHERE id = $1", productID).Scan(&prodName, &prodSKU, &curStock)
			if prodErr == nil {
				existing.ProductName = prodName
				existing.ProductSKU = prodSKU
			}

			// Read-only commit
			_ = tx.Commit(ctx)
			return &StockAdjustmentResult{
				Movement:      existing,
				CurrentStock:  curStock,
				PreviousStock: curStock,
				Replayed:      true,
			}, nil
		}

		// Payload mismatch: conflict!
		return nil, ErrIdempotencyConflict
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to check idempotency key: %w", err)
	}

	// Step 3: Lock target product row using SELECT FOR UPDATE
	var currentStock int
	var productName, productSKU string
	err = tx.QueryRow(ctx, `
		SELECT name, sku, stock_quantity
		FROM products
		WHERE id = $1
		FOR UPDATE
	`, productID).Scan(&productName, &productSKU, &currentStock)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to acquire product lock: %w", err)
	}

	// Step 4 & 5: Validate requested quantity and prevent negative stock
	var newStock int
	switch moveType {
	case MovementTypeIn:
		newStock = currentStock + req.Quantity
	case MovementTypeOut:
		if currentStock < req.Quantity {
			return nil, fmt.Errorf("%w: available %d, requested %d", ErrInsufficientStock, currentStock, req.Quantity)
		}
		newStock = currentStock - req.Quantity
	default:
		return nil, fmt.Errorf("unsupported movement type: %s", moveType)
	}

	// Step 6: Update stock quantity
	_, err = tx.Exec(ctx, `
		UPDATE products
		SET stock_quantity = $1, updated_at = NOW()
		WHERE id = $2
	`, newStock, productID)
	if err != nil {
		return nil, fmt.Errorf("failed to update stock quantity: %w", err)
	}

	// Step 7: Insert stock movement audit record
	movementID := uuid.New()
	var createdMovement StockMovement
	var createdTypeStr string
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements (id, product_id, type, quantity, note, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING id, product_id, type, quantity, note, idempotency_key, created_at
	`, movementID, productID, string(moveType), req.Quantity, strings.TrimSpace(req.Note), idempKey).Scan(
		&createdMovement.ID,
		&createdMovement.ProductID,
		&createdTypeStr,
		&createdMovement.Quantity,
		&createdMovement.Note,
		&createdMovement.IdempotencyKey,
		&createdMovement.CreatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			// Idempotency conflict from race condition
			return nil, ErrIdempotencyConflict
		}
		return nil, fmt.Errorf("failed to insert stock movement: %w", err)
	}

	// Step 8: Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit stock transaction: %w", err)
	}

	createdMovement.Type = MovementType(createdTypeStr)
	createdMovement.ProductName = productName
	createdMovement.ProductSKU = productSKU

	return &StockAdjustmentResult{
		Movement:      createdMovement,
		CurrentStock:  newStock,
		PreviousStock: currentStock,
		Replayed:      false,
	}, nil
}

func (r *pgxRepository) ListMovements(ctx context.Context, q ListMovementsQuery) ([]StockMovement, int64, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if q.ProductID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("sm.product_id = $%d", argIdx))
		args = append(args, *q.ProductID)
		argIdx++
	}

	if q.Type != "" && (strings.ToUpper(q.Type) == "IN" || strings.ToUpper(q.Type) == "OUT") {
		whereClauses = append(whereClauses, fmt.Sprintf("sm.type = $%d", argIdx))
		args = append(args, strings.ToUpper(q.Type))
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM stock_movements sm WHERE %s", whereSQL)
	var totalItems int64
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&totalItems); err != nil {
		return nil, 0, fmt.Errorf("failed to count movements: %w", err)
	}

	dataQuery := fmt.Sprintf(`
		SELECT sm.id, sm.product_id, p.name, p.sku, sm.type, sm.quantity, sm.note, sm.idempotency_key, sm.created_at
		FROM stock_movements sm
		JOIN products p ON sm.product_id = p.id
		WHERE %s
		ORDER BY sm.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list stock movements: %w", err)
	}
	defer rows.Close()

	movements := make([]StockMovement, 0, q.PageSize)
	for rows.Next() {
		var sm StockMovement
		var tStr string
		if err := rows.Scan(
			&sm.ID,
			&sm.ProductID,
			&sm.ProductName,
			&sm.ProductSKU,
			&tStr,
			&sm.Quantity,
			&sm.Note,
			&sm.IdempotencyKey,
			&sm.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan stock movement: %w", err)
		}
		sm.Type = MovementType(tStr)
		movements = append(movements, sm)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error reading stock movement rows: %w", err)
	}

	return movements, totalItems, nil
}

func (r *pgxRepository) GetMovementsByProduct(ctx context.Context, productID uuid.UUID, page, pageSize int) ([]StockMovement, int64, error) {
	return r.ListMovements(ctx, ListMovementsQuery{
		ProductID: &productID,
		Page:      page,
		PageSize:  pageSize,
	})
}
