package inventory

import (
	"time"

	"github.com/google/uuid"
)

type MovementType string

const (
	MovementTypeIn  MovementType = "IN"
	MovementTypeOut MovementType = "OUT"
)

type StockMovement struct {
	ID             uuid.UUID    `json:"id"`
	ProductID      uuid.UUID    `json:"product_id"`
	ProductName    string       `json:"product_name,omitempty"`
	ProductSKU     string       `json:"product_sku,omitempty"`
	Type           MovementType `json:"type"`
	Quantity       int          `json:"quantity"`
	Note           string       `json:"note"`
	IdempotencyKey string       `json:"idempotency_key"`
	CreatedAt      time.Time    `json:"created_at"`
}

type StockAdjustmentRequest struct {
	Quantity       int    `json:"quantity" binding:"required,gt=0"`
	Note           string `json:"note"`
	IdempotencyKey string `json:"idempotency_key" binding:"required,min=1,max=128"`
}

type StockAdjustmentResult struct {
	Movement      StockMovement `json:"movement"`
	CurrentStock  int           `json:"current_stock"`
	PreviousStock int           `json:"previous_stock"`
	Replayed      bool          `json:"replayed"`
}

type ListMovementsQuery struct {
	ProductID *uuid.UUID `form:"product_id"`
	Type      string     `form:"type"` // all, IN, OUT
	Page      int        `form:"page,default=1"`
	PageSize  int        `form:"page_size,default=20"`
}
