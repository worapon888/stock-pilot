package products

import (
	"context"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"stockpilot-backend/internal/response"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, adminMiddlewares ...gin.HandlerFunc) {
	products := rg.Group("/products")
	{
		products.GET("", h.List)
		products.GET("/:id", h.GetByID)

		adminOnly := products.Group("")
		for _, mw := range adminMiddlewares {
			adminOnly.Use(mw)
		}
		adminOnly.POST("", h.Create)
		adminOnly.PATCH("/:id", h.Update)
	}
}

func (h *Handler) List(c *gin.Context) {
	var query ListProductsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "Invalid query parameters", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	items, total, err := h.service.ListProducts(ctx, query)
	if err != nil {
		response.InternalServerError(c, "Failed to retrieve products")
		return
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 {
		query.PageSize = 20
	}
	totalPages := int((total + int64(query.PageSize) - 1) / int64(query.PageSize))

	meta := response.PaginationMeta{
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalItems: total,
		TotalPages: totalPages,
	}

	response.OKWithMeta(c, items, meta)
}

func (h *Handler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid product UUID format")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	product, err := h.service.GetProductByID(ctx, id)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.NotFound(c, "Product not found")
			return
		}
		response.InternalServerError(c, "Failed to retrieve product")
		return
	}

	response.OK(c, product)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid product request payload", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	created, err := h.service.CreateProduct(ctx, req)
	if err != nil {
		if errors.Is(err, ErrDuplicateSKU) {
			response.Conflict(c, "A product with this SKU already exists")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, created, "Product created successfully")
}

func (h *Handler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid product UUID format")
		return
	}

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid update request payload", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	updated, err := h.service.UpdateProduct(ctx, id, req)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.NotFound(c, "Product not found")
			return
		}
		if errors.Is(err, ErrDuplicateSKU) {
			response.Conflict(c, "Another product with this SKU already exists")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, updated, "Product updated successfully")
}
