package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"stockpilot-backend/internal/auth"
	"stockpilot-backend/internal/config"
	"stockpilot-backend/internal/dashboard"
	"stockpilot-backend/internal/database"
	"stockpilot-backend/internal/inventory"
	"stockpilot-backend/internal/middleware"
	"stockpilot-backend/internal/products"
	"stockpilot-backend/internal/response"
)

func main() {
	// Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting StockPilot Inventory Management Backend API...")

	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		slog.Error("Configuration validation failed", slog.Any("error", err))
		os.Exit(1)
	}

	// Initialize Database
	ctx := context.Background()
	db, err := database.Connect(ctx, cfg)
	if err != nil {
		slog.Error("Database connection failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer db.Close()

	// Run SQL Migrations
	if err := db.RunMigrations(ctx); err != nil {
		slog.Error("Migration execution failed", slog.Any("error", err))
		os.Exit(1)
	}

	// Seed database with initial portfolio data
	if err := db.RunSeeds(ctx); err != nil {
		slog.Warn("Seed execution note", slog.Any("error", err))
	}

	// Seed development users (ADMIN and STAFF) if in development
	if err := db.RunUserSeeds(ctx, cfg); err != nil {
		slog.Warn("User seed execution note", slog.Any("error", err))
	}

	// Configure Gin Mode
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	router := gin.New()
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.CORS(cfg.AllowedOrigins))

	// Dependency Injection: Repositories & Services
	authRepo := auth.NewRepository(db.Pool)
	authService := auth.NewService(authRepo, cfg)
	authHandler := auth.NewHandler(authService, cfg)

	prodRepo := products.NewRepository(db.Pool)
	prodService := products.NewService(prodRepo)
	prodHandler := products.NewHandler(prodService)

	invRepo := inventory.NewRepository(db.Pool)
	invService := inventory.NewService(invRepo)
	invHandler := inventory.NewHandler(invService)

	dashHandler := dashboard.NewHandler(db.Pool)

	// API Routing: /api/v1
	v1 := router.Group("/api/v1")
	{
		// Health Check (Public)
		v1.GET("/health", func(c *gin.Context) {
			dbErr := db.Ping(c.Request.Context())
			dbStatus := "connected"
			if dbErr != nil {
				dbStatus = "error: " + dbErr.Error()
			}

			response.OK(c, gin.H{
				"status":      "ok",
				"service":     "stockpilot-api",
				"version":     "1.0.0",
				"database":    dbStatus,
				"timestamp":   time.Now().UTC().Format(time.RFC3339),
				"environment": cfg.Env,
			})
		})

		// Authentication Handlers (/auth/login, /auth/refresh, /auth/logout, /auth/me)
		authHandler.RegisterRoutes(v1)

		// Protected Inventory & Products Endpoints
		// All require a valid access JWT token
		protected := v1.Group("")
		protected.Use(auth.RequireAuth(cfg.JWTSecret))
		{
			// Dashboard: Accessible to ADMIN and STAFF
			dashHandler.RegisterRoutes(protected)

			// Inventory movements and stock IN/OUT: Accessible to ADMIN and STAFF
			invHandler.RegisterRoutes(protected)

			// Products: List & GetByID accessible to ADMIN and STAFF;
			// Create & Update strictly restricted to ADMIN only (STAFF gets 403 Forbidden)
			prodHandler.RegisterRoutes(protected, auth.RequireRole(auth.RoleAdmin))
		}
	}

	// HTTP Server with timeouts
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Run HTTP server in background goroutine
	go func() {
		slog.Info("StockPilot API Server listening", slog.String("addr", serverAddr), slog.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP server failed", slog.Any("error", err))
		}
	}()

	// Graceful Shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("Shutdown signal received", slog.String("signal", sig.String()))

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", slog.Any("error", err))
	} else {
		slog.Info("Server exited cleanly")
	}
}
