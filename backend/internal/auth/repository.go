package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	CreateSession(ctx context.Context, session *RefreshSession) error
	GetSessionByTokenHash(ctx context.Context, tokenHash string) (*RefreshSession, error)
	RevokeSession(ctx context.Context, id uuid.UUID) error
	RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error
	RevokeSessionsByUserID(ctx context.Context, userID uuid.UUID) error
	DeleteExpiredSessions(ctx context.Context) error
}

type pgRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, full_name, email, password_hash, role, is_active, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`
	var u User
	err := r.pool.QueryRow(ctx, query, strings.TrimSpace(email)).Scan(
		&u.ID,
		&u.FullName,
		&u.Email,
		&u.PasswordHash,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to query user by email: %w", err)
	}

	return &u, nil
}

func (r *pgRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, full_name, email, password_hash, role, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	var u User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.FullName,
		&u.Email,
		&u.PasswordHash,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to query user by id: %w", err)
	}

	return &u, nil
}

func (r *pgRepository) CreateSession(ctx context.Context, s *RefreshSession) error {
	query := `
		INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at, is_revoked, user_agent, ip_address, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		s.ID,
		s.UserID,
		s.TokenHash,
		s.ExpiresAt,
		s.IsRevoked,
		s.UserAgent,
		s.IPAddress,
		s.CreatedAt,
		s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert refresh session: %w", err)
	}

	return nil
}

func (r *pgRepository) GetSessionByTokenHash(ctx context.Context, tokenHash string) (*RefreshSession, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, is_revoked, revoked_at, user_agent, ip_address, created_at, updated_at
		FROM refresh_sessions
		WHERE token_hash = $1
	`
	var s RefreshSession
	err := r.pool.QueryRow(ctx, query, tokenHash).Scan(
		&s.ID,
		&s.UserID,
		&s.TokenHash,
		&s.ExpiresAt,
		&s.IsRevoked,
		&s.RevokedAt,
		&s.UserAgent,
		&s.IPAddress,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("failed to query refresh session: %w", err)
	}

	return &s, nil
}

func (r *pgRepository) RevokeSession(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE refresh_sessions
		SET is_revoked = TRUE, revoked_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND is_revoked = FALSE
	`
	_, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to revoke session by id: %w", err)
	}
	return nil
}

func (r *pgRepository) RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error {
	query := `
		UPDATE refresh_sessions
		SET is_revoked = TRUE, revoked_at = NOW(), updated_at = NOW()
		WHERE token_hash = $1 AND is_revoked = FALSE
	`
	_, err := r.pool.Exec(ctx, query, tokenHash)
	if err != nil {
		return fmt.Errorf("failed to revoke session by token hash: %w", err)
	}
	return nil
}

func (r *pgRepository) RevokeSessionsByUserID(ctx context.Context, userID uuid.UUID) error {
	query := `
		UPDATE refresh_sessions
		SET is_revoked = TRUE, revoked_at = NOW(), updated_at = NOW()
		WHERE user_id = $1 AND is_revoked = FALSE
	`
	_, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to revoke sessions by user id: %w", err)
	}
	return nil
}

func (r *pgRepository) DeleteExpiredSessions(ctx context.Context) error {
	query := `
		DELETE FROM refresh_sessions
		WHERE expires_at < NOW() OR (is_revoked = TRUE AND updated_at < NOW() - INTERVAL '30 days')
	`
	_, err := r.pool.Exec(ctx, query)
	return err
}
