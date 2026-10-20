package dashboard

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"stockpilot-backend/internal/inventory"
	"stockpilot-backend/internal/products"
	"stockpilot-backend/internal/response"
)

type SummaryResponse struct {
	TotalProducts    int                       `json:"total_products"`
	TotalStock       int                       `json:"total_stock"`
	TotalValue       float64                   `json:"total_value"`
	LowStockCount    int                       `json:"low_stock_count"`
	LowStockProducts []products.Product        `json:"low_stock_products"`
	RecentMovements  []inventory.StockMovement `json:"recent_movements"`
}

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/dashboard/summary", h.GetSummary)
}

func (h *Handler) GetSummary(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var summary SummaryResponse
	summary.LowStockProducts = make([]products.Product, 0)
	summary.RecentMovements = make([]inventory.StockMovement, 0)

	// 1. Overall stats: total products, total stock quantity, total value
	statsQuery := `
		SELECT 
			COUNT(*),
			COALESCE(SUM(stock_quantity), 0),
			COALESCE(SUM(stock_quantity * price), 0.00),
			COUNT(CASE WHEN stock_quantity <= min_stock THEN 1 END)
		FROM products
	`
	if err := h.pool.QueryRow(ctx, statsQuery).Scan(
		&summary.TotalProducts,
		&summary.TotalStock,
		&summary.TotalValue,
		&summary.LowStockCount,
	); err != nil {
		response.InternalServerError(c, "Failed to calculate dashboard statistics: "+err.Error())
		return
	}

	// 2. Fetch up to 5 low-stock products
	lowStockQuery := `
		SELECT id, sku, name, price, stock_quantity, min_stock, created_at, updated_at
		FROM products
		WHERE stock_quantity <= min_stock
		ORDER BY stock_quantity ASC, min_stock DESC
		LIMIT 5
	`
	rows, err := h.pool.Query(ctx, lowStockQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p products.Product
			if err := rows.Scan(
				&p.ID,
				&p.SKU,
				&p.Name,
				&p.Price,
				&p.StockQuantity,
				&p.MinStock,
				&p.CreatedAt,
				&p.UpdatedAt,
			); err == nil {
				summary.LowStockProducts = append(summary.LowStockProducts, p)
			}
		}
	}

	// 3. Fetch latest 6 movements
	movementsQuery := `
		SELECT sm.id, sm.product_id, p.name, p.sku, sm.type, sm.quantity, sm.note, sm.idempotency_key, sm.created_at
		FROM stock_movements sm
		JOIN products p ON sm.product_id = p.id
		ORDER BY sm.created_at DESC
		LIMIT 6
	`
	mRows, err := h.pool.Query(ctx, movementsQuery)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var sm inventory.StockMovement
			var tStr string
			if err := mRows.Scan(
				&sm.ID,
				&sm.ProductID,
				&sm.ProductName,
				&sm.ProductSKU,
				&tStr,
				&sm.Quantity,
				&sm.Note,
				&sm.IdempotencyKey,
				&sm.CreatedAt,
			); err == nil {
				sm.Type = inventory.MovementType(tStr)
				summary.RecentMovements = append(summary.RecentMovements, sm)
			}
		}
	}

	response.OK(c, summary)
}
