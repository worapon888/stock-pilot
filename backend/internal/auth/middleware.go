package auth

import (
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"stockpilot-backend/internal/response"
)

const (
	ContextKeyUserID     = "auth_user_id"
	ContextKeyUserEmail  = "auth_user_email"
	ContextKeyUserRole   = "auth_user_role"
	ContextKeyUserClaims = "auth_user_claims"
)

// RequireAuth ensures a valid Bearer JWT is provided on every request
func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Authorization header is required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Unauthorized(c, "Invalid authorization header format. Expected 'Bearer <token>'")
			c.Abort()
			return
		}

		tokenStr := strings.TrimSpace(parts[1])
		if tokenStr == "" {
			response.Unauthorized(c, "Bearer token must not be empty")
			c.Abort()
			return
		}

		claims, err := ValidateAccessToken(tokenStr, jwtSecret)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired access token", err.Error())
			c.Abort()
			return
		}

		c.Set(ContextKeyUserID, claims.UserID)
		c.Set(ContextKeyUserEmail, claims.Email)
		c.Set(ContextKeyUserRole, claims.Role)
		c.Set(ContextKeyUserClaims, claims)

		c.Next()
	}
}

// RequireRole enforces role-based access control (RBAC). Returns 403 Forbidden on mismatch.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get(ContextKeyUserRole)
		if !exists {
			response.Unauthorized(c, "Authentication required")
			c.Abort()
			return
		}

		userRole, ok := roleVal.(string)
		if !ok {
			response.Unauthorized(c, "Invalid user session")
			c.Abort()
			return
		}

		for _, allowed := range allowedRoles {
			if strings.EqualFold(userRole, allowed) {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Insufficient permissions to perform this action")
		c.Abort()
	}
}

func GetAuthUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(ContextKeyUserID)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetAuthUserRole(c *gin.Context) (string, bool) {
	val, exists := c.Get(ContextKeyUserRole)
	if !exists {
		return "", false
	}
	role, ok := val.(string)
	return role, ok
}

// Simple in-memory rate limiter for login protection
type RateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}

	// Background routine to evict stale entries every minute
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	var valid []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.attempts[key] = valid
		return false
	}

	rl.attempts[key] = append(valid, now)
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)
	for key, times := range rl.attempts {
		var valid []time.Time
		for _, t := range times {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(rl.attempts, key)
		} else {
			rl.attempts[key] = valid
		}
	}
}

func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if !limiter.Allow(clientIP) {
			response.TooManyRequests(c, "Too many login attempts. Please try again in a few minutes.")
			c.Abort()
			return
		}
		c.Next()
	}
}
