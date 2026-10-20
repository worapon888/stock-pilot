package products

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
	ErrProductNotFound = errors.New("product not found")
	ErrDuplicateSKU    = errors.New("a product with this SKU already exists")
)

type Repository interface {
	Create(ctx context.Context, p *Product) (*Product, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Product, error)
	GetBySKU(ctx context.Context, sku string) (*Product, error)
	List(ctx context.Context, q ListProductsQuery) ([]Product, int64, error)
	Update(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error)
}

type pgxRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgxRepository{pool: pool}
}

func (r *pgxRepository) Create(ctx context.Context, p *Product) (*Product, error) {
	query := `
		INSERT INTO products (sku, name, price, stock_quantity, min_stock, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
	`
	var created Product
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(p.SKU),
		strings.TrimSpace(p.Name),
		p.Price,
		p.StockQuantity,
		p.MinStock,
	).Scan(
		&created.ID,
		&created.SKU,
		&created.Name,
		&created.Price,
		&created.StockQuantity,
		&created.MinStock,
		&created.CreatedAt,
		&created.UpdatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateSKU
		}
		return nil, fmt.Errorf("failed to insert product: %w", err)
	}

	return &created, nil
}

func (r *pgxRepository) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	query := `
		SELECT id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
		FROM products
		WHERE id = $1
	`
	var p Product
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID,
		&p.SKU,
		&p.Name,
		&p.Price,
		&p.StockQuantity,
		&p.MinStock,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to get product by id: %w", err)
	}

	return &p, nil
}

func (r *pgxRepository) GetBySKU(ctx context.Context, sku string) (*Product, error) {
	query := `
		SELECT id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
		FROM products
		WHERE LOWER(sku) = LOWER($1)
	`
	var p Product
	err := r.pool.QueryRow(ctx, query, strings.TrimSpace(sku)).Scan(
		&p.ID,
		&p.SKU,
		&p.Name,
		&p.Price,
		&p.StockQuantity,
		&p.MinStock,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		return nil, fmt.Errorf("failed to get product by sku: %w", err)
	}

	return &p, nil
}

func (r *pgxRepository) List(ctx context.Context, q ListProductsQuery) ([]Product, int64, error) {
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

	if q.Search != "" {
		searchTerm := "%" + strings.ToLower(strings.TrimSpace(q.Search)) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(LOWER(name) LIKE $%d OR LOWER(sku) LIKE $%d)", argIdx, argIdx))
		args = append(args, searchTerm)
		argIdx++
	}

	switch strings.ToLower(q.Filter) {
	case "low_stock":
		whereClauses = append(whereClauses, "stock_quantity > 0 AND stock_quantity <= min_stock")
	case "out_of_stock":
		whereClauses = append(whereClauses, "stock_quantity = 0")
	case "in_stock":
		whereClauses = append(whereClauses, "stock_quantity > 0")
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products WHERE %s", whereSQL)
	var totalItems int64
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&totalItems); err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	dataQuery := fmt.Sprintf(`
		SELECT id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
		FROM products
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	products := make([]Product, 0, q.PageSize)
	for rows.Next() {
		var p Product
		if err := rows.Scan(
			&p.ID,
			&p.SKU,
			&p.Name,
			&p.Price,
			&p.StockQuantity,
			&p.MinStock,
			&p.CreatedAt,
			&p.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error reading product rows: %w", err)
	}

	return products, totalItems, nil
}

func (r *pgxRepository) Update(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{id}
	argIdx := 2

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Name))
		argIdx++
	}
	if req.SKU != nil {
		setClauses = append(setClauses, fmt.Sprintf("sku = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.SKU))
		argIdx++
	}
	if req.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *req.Price)
		argIdx++
	}
	if req.MinStock != nil {
		setClauses = append(setClauses, fmt.Sprintf("min_stock = $%d", argIdx))
		args = append(args, *req.MinStock)
		argIdx++
	}

	query := fmt.Sprintf(`
		UPDATE products
		SET %s
		WHERE id = $1
		RETURNING id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
	`, strings.Join(setClauses, ", "))

	var updated Product
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&updated.ID,
		&updated.SKU,
		&updated.Name,
		&updated.Price,
		&updated.StockQuantity,
		&updated.MinStock,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateSKU
		}
		return nil, fmt.Errorf("failed to update product: %w", err)
	}

	return &updated, nil
}
