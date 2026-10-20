package inventory

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type Service interface {
	StockIn(ctx context.Context, productID uuid.UUID, req StockAdjustmentRequest) (*StockAdjustmentResult, error)
	StockOut(ctx context.Context, productID uuid.UUID, req StockAdjustmentRequest) (*StockAdjustmentResult, error)
	ListMovements(ctx context.Context, q ListMovementsQuery) ([]StockMovement, int64, error)
	GetProductMovements(ctx context.Context, productID uuid.UUID, page, pageSize int) ([]StockMovement, int64, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) StockIn(ctx context.Context, productID uuid.UUID, req StockAdjustmentRequest) (*StockAdjustmentResult, error) {
	if req.Quantity <= 0 {
		return nil, errors.New("quantity must be greater than zero")
	}
	if req.IdempotencyKey == "" {
		return nil, errors.New("idempotency_key is required")
	}
	return s.repo.AdjustStock(ctx, productID, MovementTypeIn, req)
}

func (s *service) StockOut(ctx context.Context, productID uuid.UUID, req StockAdjustmentRequest) (*StockAdjustmentResult, error) {
	if req.Quantity <= 0 {
		return nil, errors.New("quantity must be greater than zero")
	}
	if req.IdempotencyKey == "" {
		return nil, errors.New("idempotency_key is required")
	}
	return s.repo.AdjustStock(ctx, productID, MovementTypeOut, req)
}

func (s *service) ListMovements(ctx context.Context, q ListMovementsQuery) ([]StockMovement, int64, error) {
	return s.repo.ListMovements(ctx, q)
}

func (s *service) GetProductMovements(ctx context.Context, productID uuid.UUID, page, pageSize int) ([]StockMovement, int64, error) {
	return s.repo.GetMovementsByProduct(ctx, productID, page, pageSize)
}
