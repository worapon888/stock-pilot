package auth

import (
	"context"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"stockpilot-backend/internal/config"
	"stockpilot-backend/internal/response"
)

type Handler struct {
	service     Service
	cfg         *config.Config
	rateLimiter *RateLimiter
}

func NewHandler(service Service, cfg *config.Config) *Handler {
	// Rate limit: max 15 login attempts per minute per IP
	rl := NewRateLimiter(15, time.Minute)
	return &Handler{
		service:     service,
		cfg:         cfg,
		rateLimiter: rl,
	}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	{
		// Public Auth Endpoints
		auth.POST("/login", RateLimitMiddleware(h.rateLimiter), h.Login)
		auth.POST("/refresh", h.Refresh)

		// Protected Auth Endpoints
		auth.POST("/logout", RequireAuth(h.cfg.JWTSecret), h.Logout)
		auth.GET("/me", RequireAuth(h.cfg.JWTSecret), h.Me)
	}
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid login credentials format", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userAgent := c.Request.UserAgent()
	clientIP := c.ClientIP()

	loginResp, err := h.service.Login(ctx, req, userAgent, clientIP)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Unauthorized(c, "Invalid email or password")
			return
		}
		if errors.Is(err, ErrUserInactive) {
			response.Forbidden(c, "Account is disabled. Please contact an administrator.")
			return
		}
		response.InternalServerError(c, "Failed to authenticate user")
		return
	}

	response.OK(c, loginResp, "เข้าสู่ระบบสำเร็จ")
}

func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Missing or invalid refresh_token", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userAgent := c.Request.UserAgent()
	clientIP := c.ClientIP()

	refreshResp, err := h.service.Refresh(ctx, req.RefreshToken, userAgent, clientIP)
	if err != nil {
		if errors.Is(err, ErrInvalidToken) || errors.Is(err, ErrTokenRevoked) || errors.Is(err, ErrSessionExpired) {
			response.Unauthorized(c, "Invalid or expired session token")
			return
		}
		if errors.Is(err, ErrUserInactive) {
			response.Forbidden(c, "Account is disabled")
			return
		}
		response.InternalServerError(c, "Failed to refresh authentication session")
		return
	}

	response.OK(c, refreshResp, "Session refreshed successfully")
}

func (h *Handler) Logout(c *gin.Context) {
	var req LogoutRequest
	_ = c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.service.Logout(ctx, req.RefreshToken); err != nil {
		response.InternalServerError(c, "Failed to revoke session")
		return
	}

	response.OK(c, gin.H{"logged_out": true}, "ออกจากระบบสำเร็จ")
}

func (h *Handler) Me(c *gin.Context) {
	userID, ok := GetAuthUserID(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	profile, err := h.service.GetMe(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.NotFound(c, "User not found")
			return
		}
		if errors.Is(err, ErrUserInactive) {
			response.Forbidden(c, "User account is disabled")
			return
		}
		response.InternalServerError(c, "Failed to retrieve user profile")
		return
	}

	response.OK(c, profile)
}
