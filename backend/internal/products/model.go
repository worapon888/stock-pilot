package products

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID            uuid.UUID `json:"id"`
	SKU           string    `json:"sku"`
	Name          string    `json:"name"`
	Price         float64   `json:"price"`
	StockQuantity int       `json:"stock_quantity"`
	MinStock      int       `json:"min_stock"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CreateProductRequest struct {
	SKU           string  `json:"sku" binding:"required,min=2,max=64"`
	Name          string  `json:"name" binding:"required,min=2,max=255"`
	Price         float64 `json:"price" binding:"required,gte=0"`
	StockQuantity int     `json:"stock_quantity" binding:"gte=0"`
	MinStock      int     `json:"min_stock" binding:"gte=0"`
}

type UpdateProductRequest struct {
	Name     *string  `json:"name,omitempty"`
	SKU      *string  `json:"sku,omitempty"`
	Price    *float64 `json:"price,omitempty"`
	MinStock *int     `json:"min_stock,omitempty"`
}

type ListProductsQuery struct {
	Search   string `form:"search"`
	Filter   string `form:"filter"` // all, low_stock, out_of_stock, in_stock
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"page_size,default=20"`
}
