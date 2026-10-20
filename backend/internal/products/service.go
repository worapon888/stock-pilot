package products

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

type Service interface {
	CreateProduct(ctx context.Context, req CreateProductRequest) (*Product, error)
	GetProductByID(ctx context.Context, id uuid.UUID) (*Product, error)
	ListProducts(ctx context.Context, q ListProductsQuery) ([]Product, int64, error)
	UpdateProduct(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateProduct(ctx context.Context, req CreateProductRequest) (*Product, error) {
	req.SKU = strings.ToUpper(strings.TrimSpace(req.SKU))
	req.Name = strings.TrimSpace(req.Name)

	if req.SKU == "" {
		return nil, errors.New("SKU cannot be empty")
	}
	if req.Name == "" {
		return nil, errors.New("product name cannot be empty")
	}
	if req.Price < 0 {
		return nil, errors.New("price cannot be negative")
	}
	if req.StockQuantity < 0 {
		return nil, errors.New("stock quantity cannot be negative")
	}
	if req.MinStock < 0 {
		return nil, errors.New("minimum stock threshold cannot be negative")
	}

	p := &Product{
		SKU:           req.SKU,
		Name:          req.Name,
		Price:         req.Price,
		StockQuantity: req.StockQuantity,
		MinStock:      req.MinStock,
	}

	return s.repo.Create(ctx, p)
}

func (s *service) GetProductByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *service) ListProducts(ctx context.Context, q ListProductsQuery) ([]Product, int64, error) {
	return s.repo.List(ctx, q)
}

func (s *service) UpdateProduct(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error) {
	if req.SKU != nil {
		sku := strings.ToUpper(strings.TrimSpace(*req.SKU))
		if sku == "" {
			return nil, errors.New("SKU cannot be empty")
		}
		req.SKU = &sku
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("product name cannot be empty")
		}
		req.Name = &name
	}
	if req.Price != nil && *req.Price < 0 {
		return nil, errors.New("price cannot be negative")
	}
	if req.MinStock != nil && *req.MinStock < 0 {
		return nil, errors.New("minimum stock threshold cannot be negative")
	}

	return s.repo.Update(ctx, id, req)
}
