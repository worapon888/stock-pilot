package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"stockpilot-backend/internal/config"
)

type Service interface {
	Login(ctx context.Context, req LoginRequest, userAgent, ipAddress string) (*LoginResponse, error)
	Refresh(ctx context.Context, refreshToken, userAgent, ipAddress string) (*RefreshResponse, error)
	Logout(ctx context.Context, refreshToken string) error
	GetMe(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
}

type authService struct {
	repo Repository
	cfg  *config.Config
}

func NewService(repo Repository, cfg *config.Config) Service {
	return &authService{
		repo: repo,
		cfg:  cfg,
	}
}

func (s *authService) Login(ctx context.Context, req LoginRequest, userAgent, ipAddress string) (*LoginResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			// Constant-time dummy compare to mitigate timing-based user enumeration attacks
			_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$abcdefghijklmnopqrstuvwxyz01234567890123456789012345678"), []byte(req.Password))
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("login failed: %w", err)
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Verify user active state
	if !user.IsActive {
		return nil, ErrUserInactive
	}

	// Generate Access Token
	accessToken, err := GenerateAccessToken(user, s.cfg.JWTSecret, s.cfg.JWTAccessTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate Refresh Token
	refreshToken, tokenHash, err := GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Persist session in PostgreSQL
	expiresAt := time.Now().UTC().Add(s.cfg.JWTRefreshTTL)
	session := &RefreshSession{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		IsRevoked: false,
		UserAgent: userAgent,
		IPAddress: ipAddress,
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to save refresh session: %w", err)
	}

	slog.Info("User logged in successfully",
		slog.String("user_id", user.ID.String()),
		slog.String("email", user.Email),
		slog.String("role", user.Role),
	)

	return &LoginResponse{
		User:         user.ToResponse(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.JWTAccessTTL.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

func (s *authService) Refresh(ctx context.Context, refreshToken, userAgent, ipAddress string) (*RefreshResponse, error) {
	if refreshToken == "" {
		return nil, ErrInvalidToken
	}

	tokenHash := HashToken(refreshToken)
	session, err := s.repo.GetSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, ErrInvalidToken) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("failed to retrieve session: %w", err)
	}

	// Check if already revoked
	if session.IsRevoked {
		slog.Warn("Attempted to use revoked refresh token",
			slog.String("session_id", session.ID.String()),
			slog.String("user_id", session.UserID.String()),
		)
		// Security: revoke all user sessions if a compromised/revoked token was reused
		_ = s.repo.RevokeSessionsByUserID(ctx, session.UserID)
		return nil, ErrTokenRevoked
	}

	// Check if session has expired
	if session.ExpiresAt.Before(time.Now().UTC()) {
		_ = s.repo.RevokeSession(ctx, session.ID)
		return nil, ErrSessionExpired
	}

	// Retrieve user
	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve session user: %w", err)
	}

	if !user.IsActive {
		_ = s.repo.RevokeSession(ctx, session.ID)
		return nil, ErrUserInactive
	}

	// REFRESH TOKEN ROTATION:
	// 1. Invalidate/revoke current session
	if err := s.repo.RevokeSession(ctx, session.ID); err != nil {
		return nil, fmt.Errorf("failed to rotate session: %w", err)
	}

	// 2. Issue new refresh token
	newRefreshToken, newTokenHash, err := GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate rotated refresh token: %w", err)
	}

	// 3. Save new session
	newSession := &RefreshSession{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: newTokenHash,
		ExpiresAt: time.Now().UTC().Add(s.cfg.JWTRefreshTTL),
		IsRevoked: false,
		UserAgent: userAgent,
		IPAddress: ipAddress,
	}

	if err := s.repo.CreateSession(ctx, newSession); err != nil {
		return nil, fmt.Errorf("failed to persist rotated session: %w", err)
	}

	// 4. Issue new access token
	newAccessToken, err := GenerateAccessToken(user, s.cfg.JWTSecret, s.cfg.JWTAccessTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token on refresh: %w", err)
	}

	slog.Info("Session refreshed and rotated successfully",
		slog.String("user_id", user.ID.String()),
		slog.String("session_id", newSession.ID.String()),
	)

	return &RefreshResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int64(s.cfg.JWTAccessTTL.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

func (s *authService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}

	tokenHash := HashToken(refreshToken)
	if err := s.repo.RevokeSessionByTokenHash(ctx, tokenHash); err != nil {
		return fmt.Errorf("failed to revoke session on logout: %w", err)
	}

	slog.Info("Session revoked on logout")
	return nil
}

func (s *authService) GetMe(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if !user.IsActive {
		return nil, ErrUserInactive
	}

	resp := user.ToResponse()
	return &resp, nil
}
