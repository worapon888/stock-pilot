package database

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"stockpilot-backend/internal/config"
)

//go:embed sql/*.sql
var migrationFS embed.FS

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, cfg *config.Config) (*DB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL())
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	poolConfig.MaxConns = cfg.DBPoolMaxConns
	poolConfig.MinConns = cfg.DBPoolMinConns
	poolConfig.MaxConnLifetime = cfg.DBPoolMaxConnLife
	poolConfig.MaxConnIdleTime = cfg.DBPoolMaxConnIdle

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(connectCtx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	slog.Info("Successfully connected to PostgreSQL database",
		slog.String("host", cfg.DBHost),
		slog.String("port", cfg.DBPort),
		slog.String("database", cfg.DBName),
	)

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

func (db *DB) Ping(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return db.Pool.Ping(ctx)
}

func (db *DB) RunMigrations(ctx context.Context) error {
	slog.Info("Executing database migrations...")

	migrationFiles := []string{
		"sql/000001_create_products.up.sql",
		"sql/000002_create_stock_movements.up.sql",
		"sql/000004_create_users_and_sessions.up.sql",
	}

	for _, file := range migrationFiles {
		sqlContent, err := migrationFS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", file, err)
		}

		slog.Info("Applying migration", slog.String("file", file))
		if _, err := db.Pool.Exec(ctx, string(sqlContent)); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", file, err)
		}
	}

	slog.Info("All database migrations applied successfully")
	return nil
}

func (db *DB) RunSeeds(ctx context.Context) error {
	slog.Info("Seeding initial data if empty...")
	sqlContent, err := migrationFS.ReadFile("sql/000003_seed_data.sql")
	if err != nil {
		return fmt.Errorf("failed to read seed file: %w", err)
	}

	if _, err := db.Pool.Exec(ctx, string(sqlContent)); err != nil {
		return fmt.Errorf("failed to execute seeds: %w", err)
	}

	slog.Info("Database seed data applied successfully")
	return nil
}

// RunUserSeeds seeds development ADMIN and STAFF users if not in production
func (db *DB) RunUserSeeds(ctx context.Context, cfg *config.Config) error {
	if cfg.IsProduction() {
		slog.Info("Skipping development user seeding in production environment")
		return nil
	}

	if cfg.DevAdminPassword == "" || cfg.DevStaffPassword == "" {
		slog.Info("Skipping development user seeding because development passwords are empty")
		return nil
	}

	slog.Info("Checking and seeding development users...")

	users := []struct {
		Name     string
		Email    string
		Password string
		Role     string
	}{
		{
			Name:     cfg.DevAdminName,
			Email:    cfg.DevAdminEmail,
			Password: cfg.DevAdminPassword,
			Role:     "ADMIN",
		},
		{
			Name:     cfg.DevStaffName,
			Email:    cfg.DevStaffEmail,
			Password: cfg.DevStaffPassword,
			Role:     "STAFF",
		},
	}

	for _, u := range users {
		var existingID string
		err := db.Pool.QueryRow(ctx, "SELECT id FROM users WHERE LOWER(email) = LOWER($1)", u.Email).Scan(&existingID)
		if err == nil {
			continue // Already seeded
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash password for %s: %w", u.Email, err)
		}

		_, err = db.Pool.Exec(ctx, `
			INSERT INTO users (full_name, email, password_hash, role, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, true, NOW(), NOW())
			ON CONFLICT (email) DO NOTHING
		`, u.Name, u.Email, string(hash), u.Role)
		if err != nil {
			return fmt.Errorf("failed to seed user %s: %w", u.Email, err)
		}
		slog.Info("Seeded development user", slog.String("email", u.Email), slog.String("role", u.Role))
	}

	return nil
}
