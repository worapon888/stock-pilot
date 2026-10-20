package inventory

import (
	"context"
	"errors"
	"strconv"
	"strings"
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

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Product specific stock operations
	products := rg.Group("/products/:id")
	{
		products.POST("/stock-in", h.StockIn)
		products.POST("/stock-out", h.StockOut)
		products.GET("/movements", h.GetProductMovements)
	}

	// Global stock movements list
	movements := rg.Group("/stock-movements")
	{
		movements.GET("", h.ListMovements)
	}
}

func (h *Handler) StockIn(c *gin.Context) {
	idStr := c.Param("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid product UUID format")
		return
	}

	var req StockAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid stock-in payload", err.Error())
		return
	}

	// Fallback to header if not in JSON
	if req.IdempotencyKey == "" {
		req.IdempotencyKey = c.GetHeader("Idempotency-Key")
	}

	if req.IdempotencyKey == "" {
		response.BadRequest(c, "Missing required idempotency_key in body or Idempotency-Key header")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	result, err := h.service.StockIn(ctx, productID, req)
	if err != nil {
		h.handleAdjustmentError(c, err)
		return
	}

	c.Header("Idempotency-Key", req.IdempotencyKey)
	if result.Replayed {
		c.Header("Idempotency-Replayed", "true")
	}

	response.OK(c, result, "Stock increased successfully")
}

func (h *Handler) StockOut(c *gin.Context) {
	idStr := c.Param("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid product UUID format")
		return
	}

	var req StockAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid stock-out payload", err.Error())
		return
	}

	if req.IdempotencyKey == "" {
		req.IdempotencyKey = c.GetHeader("Idempotency-Key")
	}

	if req.IdempotencyKey == "" {
		response.BadRequest(c, "Missing required idempotency_key in body or Idempotency-Key header")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	result, err := h.service.StockOut(ctx, productID, req)
	if err != nil {
		h.handleAdjustmentError(c, err)
		return
	}

	c.Header("Idempotency-Key", req.IdempotencyKey)
	if result.Replayed {
		c.Header("Idempotency-Replayed", "true")
	}

	response.OK(c, result, "Stock decreased successfully")
}

func (h *Handler) ListMovements(c *gin.Context) {
	var query ListMovementsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "Invalid query parameters", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	movements, total, err := h.service.ListMovements(ctx, query)
	if err != nil {
		response.InternalServerError(c, "Failed to retrieve stock movements")
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

	response.OKWithMeta(c, movements, meta)
}

func (h *Handler) GetProductMovements(c *gin.Context) {
	idStr := c.Param("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid product UUID format")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	movements, total, err := h.service.GetProductMovements(ctx, productID, page, pageSize)
	if err != nil {
		response.InternalServerError(c, "Failed to retrieve product stock movements")
		return
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	meta := response.PaginationMeta{
		Page:       page,
		PageSize:   pageSize,
		TotalItems: total,
		TotalPages: totalPages,
	}

	response.OKWithMeta(c, movements, meta)
}

func (h *Handler) handleAdjustmentError(c *gin.Context, err error) {
	if errors.Is(err, ErrProductNotFound) {
		response.NotFound(c, "Product not found")
		return
	}
	if errors.Is(err, ErrInsufficientStock) {
		response.UnprocessableEntity(c, err.Error())
		return
	}
	if errors.Is(err, ErrIdempotencyConflict) {
		response.Conflict(c, "Idempotency key was previously used with a different operation or payload")
		return
	}
	if errors.Is(err, ErrInvalidQuantity) || strings.Contains(err.Error(), "quantity") {
		response.BadRequest(c, err.Error())
		return
	}
	response.InternalServerError(c, "Transaction error processing stock adjustment: "+err.Error())
}
