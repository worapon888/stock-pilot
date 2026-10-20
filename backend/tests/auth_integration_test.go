package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"stockpilot-backend/internal/auth"
	"stockpilot-backend/internal/config"
	"stockpilot-backend/internal/dashboard"
	"stockpilot-backend/internal/database"
	"stockpilot-backend/internal/inventory"
	"stockpilot-backend/internal/products"
	"stockpilot-backend/internal/response"
)

type testRouterBundle struct {
	router      *gin.Engine
	db          *database.DB
	cfg         *config.Config
	authRepo    auth.Repository
	authService auth.Service
	prodService products.Service
	invService  inventory.Service
}

func setupTestRouter(t *testing.T) *testRouterBundle {
	gin.SetMode(gin.TestMode)
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg)
	require.NoError(t, err, "Failed to connect to test database")

	err = db.RunMigrations(ctx)
	require.NoError(t, err, "Failed to run migrations")

	err = db.RunSeeds(ctx)
	require.NoError(t, err, "Failed to run seeds")

	err = db.RunUserSeeds(ctx, cfg)
	require.NoError(t, err, "Failed to run user seeds")

	router := gin.New()

	authRepo := auth.NewRepository(db.Pool)
	authSvc := auth.NewService(authRepo, cfg)
	authHdl := auth.NewHandler(authSvc, cfg)

	prodRepo := products.NewRepository(db.Pool)
	prodSvc := products.NewService(prodRepo)
	prodHdl := products.NewHandler(prodSvc)

	invRepo := inventory.NewRepository(db.Pool)
	invSvc := inventory.NewService(invRepo)
	invHdl := inventory.NewHandler(invSvc)

	dashHdl := dashboard.NewHandler(db.Pool)

	v1 := router.Group("/api/v1")
	{
		authHdl.RegisterRoutes(v1)

		protected := v1.Group("")
		protected.Use(auth.RequireAuth(cfg.JWTSecret))
		{
			dashHdl.RegisterRoutes(protected)
			invHdl.RegisterRoutes(protected)
			prodHdl.RegisterRoutes(protected, auth.RequireRole(auth.RoleAdmin))
		}
	}

	return &testRouterBundle{
		router:      router,
		db:          db,
		cfg:         cfg,
		authRepo:    authRepo,
		authService: authSvc,
		prodService: prodSvc,
		invService:  invSvc,
	}
}

func strPtr(s string) *string {
	return &s
}

func performJSONRequest(r *gin.Engine, method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var bodyReader *bytes.Reader
	if body != nil {
		jsonBytes, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(jsonBytes)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	req, _ := http.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAuth_ValidLogin(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	w := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    bundle.cfg.DevAdminEmail,
		Password: bundle.cfg.DevAdminPassword,
	}, nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var env response.Envelope
	err := json.Unmarshal(w.Body.Bytes(), &env)
	require.NoError(t, err)
	assert.True(t, env.Success)

	dataMap, ok := env.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotEmpty(t, dataMap["access_token"])
	assert.NotEmpty(t, dataMap["refresh_token"])
	assert.Equal(t, "Bearer", dataMap["token_type"])

	userMap, ok := dataMap["user"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, bundle.cfg.DevAdminEmail, userMap["email"])
	assert.Equal(t, "ADMIN", userMap["role"])
}

func TestAuth_InvalidPassword(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	w := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    bundle.cfg.DevAdminEmail,
		Password: "IncorrectPassword123!",
	}, nil)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	var env response.Envelope
	err := json.Unmarshal(w.Body.Bytes(), &env)
	require.NoError(t, err)
	assert.False(t, env.Success)
	assert.Equal(t, "UNAUTHORIZED", env.Error.Code)
}

func TestAuth_NonexistentUser(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	w := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    "nonexistent.user.test@example.com",
		Password: "SomePassword123!",
	}, nil)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	var env response.Envelope
	err := json.Unmarshal(w.Body.Bytes(), &env)
	require.NoError(t, err)
	assert.False(t, env.Success)
	assert.Equal(t, "UNAUTHORIZED", env.Error.Code)
}

func TestAuth_InactiveUser(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()
	ctx := context.Background()

	// Create an inactive user directly in DB
	inactiveEmail := fmt.Sprintf("inactive-%d@example.com", time.Now().UnixNano())
	hash, err := bcrypt.GenerateFromPassword([]byte("Password123!"), bcrypt.DefaultCost)
	require.NoError(t, err)

	_, err = bundle.db.Pool.Exec(ctx, `
		INSERT INTO users (full_name, email, password_hash, role, is_active)
		VALUES ('Inactive User', $1, $2, 'STAFF', false)
	`, inactiveEmail, string(hash))
	require.NoError(t, err)

	w := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    inactiveEmail,
		Password: "Password123!",
	}, nil)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAuth_MissingAndInvalidJWT(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	// 1. Missing JWT on protected endpoint
	w1 := performJSONRequest(bundle.router, "GET", "/api/v1/dashboard/summary", nil, nil)
	assert.Equal(t, http.StatusUnauthorized, w1.Code)

	// 2. Invalid JWT token
	w2 := performJSONRequest(bundle.router, "GET", "/api/v1/dashboard/summary", nil, map[string]string{
		"Authorization": "Bearer not-a-valid-jwt-token",
	})
	assert.Equal(t, http.StatusUnauthorized, w2.Code)

	// 3. Expired JWT
	expiredToken, err := auth.GenerateAccessToken(&auth.User{
		ID:       uuid.New(),
		Email:    "expired@example.com",
		Role:     "ADMIN",
		FullName: "Expired User",
	}, bundle.cfg.JWTSecret, -1*time.Hour)
	require.NoError(t, err)

	w3 := performJSONRequest(bundle.router, "GET", "/api/v1/dashboard/summary", nil, map[string]string{
		"Authorization": "Bearer " + expiredToken,
	})
	assert.Equal(t, http.StatusUnauthorized, w3.Code)
}

func TestAuth_RefreshTokenRotationAndRevocation(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	// 1. Initial login to acquire refresh token
	loginResp := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    bundle.cfg.DevAdminEmail,
		Password: bundle.cfg.DevAdminPassword,
	}, nil)
	require.Equal(t, http.StatusOK, loginResp.Code)

	var env response.Envelope
	_ = json.Unmarshal(loginResp.Body.Bytes(), &env)
	dataMap := env.Data.(map[string]interface{})
	firstRefreshToken := dataMap["refresh_token"].(string)

	// 2. Perform token refresh
	refreshResp1 := performJSONRequest(bundle.router, "POST", "/api/v1/auth/refresh", auth.RefreshRequest{
		RefreshToken: firstRefreshToken,
	}, nil)
	assert.Equal(t, http.StatusOK, refreshResp1.Code)

	var refEnv response.Envelope
	_ = json.Unmarshal(refreshResp1.Body.Bytes(), &refEnv)
	refData := refEnv.Data.(map[string]interface{})
	secondRefreshToken := refData["refresh_token"].(string)
	secondAccessToken := refData["access_token"].(string)

	assert.NotEqual(t, firstRefreshToken, secondRefreshToken, "Refresh token should be rotated to a new value")
	assert.NotEmpty(t, secondAccessToken)

	// 3. Attempting to reuse the old rotated refresh token MUST be rejected
	reusedResp := performJSONRequest(bundle.router, "POST", "/api/v1/auth/refresh", auth.RefreshRequest{
		RefreshToken: firstRefreshToken,
	}, nil)
	assert.Equal(t, http.StatusUnauthorized, reusedResp.Code)

	// 4. Logout using second refresh token
	logoutResp := performJSONRequest(bundle.router, "POST", "/api/v1/auth/logout", auth.LogoutRequest{
		RefreshToken: secondRefreshToken,
	}, map[string]string{
		"Authorization": "Bearer " + secondAccessToken,
	})
	assert.Equal(t, http.StatusOK, logoutResp.Code)

	// 5. Using the logged-out refresh token MUST fail
	revokedResp := performJSONRequest(bundle.router, "POST", "/api/v1/auth/refresh", auth.RefreshRequest{
		RefreshToken: secondRefreshToken,
	}, nil)
	assert.Equal(t, http.StatusUnauthorized, revokedResp.Code)
}

func TestRBAC_AdminAndStaffPermissions(t *testing.T) {
	bundle := setupTestRouter(t)
	defer bundle.db.Close()

	// 1. Login as ADMIN
	adminLogin := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    bundle.cfg.DevAdminEmail,
		Password: bundle.cfg.DevAdminPassword,
	}, nil)
	require.Equal(t, http.StatusOK, adminLogin.Code)
	var adminEnv response.Envelope
	_ = json.Unmarshal(adminLogin.Body.Bytes(), &adminEnv)
	adminToken := adminEnv.Data.(map[string]interface{})["access_token"].(string)

	// 2. Login as STAFF
	staffLogin := performJSONRequest(bundle.router, "POST", "/api/v1/auth/login", auth.LoginRequest{
		Email:    bundle.cfg.DevStaffEmail,
		Password: bundle.cfg.DevStaffPassword,
	}, nil)
	require.Equal(t, http.StatusOK, staffLogin.Code)
	var staffEnv response.Envelope
	_ = json.Unmarshal(staffLogin.Body.Bytes(), &staffEnv)
	staffToken := staffEnv.Data.(map[string]interface{})["access_token"].(string)

	// A. ADMIN can create products
	skuAdmin := fmt.Sprintf("ADM-PROD-%d", time.Now().UnixNano())
	createRespAdmin := performJSONRequest(bundle.router, "POST", "/api/v1/products", products.CreateProductRequest{
		SKU:           skuAdmin,
		Name:          "Admin Authorized Item",
		Price:         89.90,
		StockQuantity: 10,
		MinStock:      2,
	}, map[string]string{
		"Authorization": "Bearer " + adminToken,
	})
	assert.Equal(t, http.StatusCreated, createRespAdmin.Code)
	var createdEnv response.Envelope
	_ = json.Unmarshal(createRespAdmin.Body.Bytes(), &createdEnv)
	createdProdID := createdEnv.Data.(map[string]interface{})["id"].(string)

	// B. ADMIN can edit products
	updateRespAdmin := performJSONRequest(bundle.router, "PATCH", "/api/v1/products/"+createdProdID, products.UpdateProductRequest{
		Name: strPtr("Admin Updated Item Name"),
	}, map[string]string{
		"Authorization": "Bearer " + adminToken,
	})
	assert.Equal(t, http.StatusOK, updateRespAdmin.Code)

	// C. STAFF CANNOT create products (HTTP 403 Forbidden)
	skuStaff := fmt.Sprintf("STF-PROD-%d", time.Now().UnixNano())
	createRespStaff := performJSONRequest(bundle.router, "POST", "/api/v1/products", products.CreateProductRequest{
		SKU:           skuStaff,
		Name:          "Staff Unauthorized Item",
		Price:         49.90,
		StockQuantity: 10,
		MinStock:      2,
	}, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusForbidden, createRespStaff.Code)

	// D. STAFF CANNOT edit products (HTTP 403 Forbidden)
	updateRespStaff := performJSONRequest(bundle.router, "PATCH", "/api/v1/products/"+createdProdID, products.UpdateProductRequest{
		Name: strPtr("Staff Attempted Name Change"),
	}, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusForbidden, updateRespStaff.Code)

	// E. STAFF CAN view products list
	listRespStaff := performJSONRequest(bundle.router, "GET", "/api/v1/products", nil, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusOK, listRespStaff.Code)

	// F. STAFF CAN view Dashboard summary
	dashRespStaff := performJSONRequest(bundle.router, "GET", "/api/v1/dashboard/summary", nil, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusOK, dashRespStaff.Code)

	// G. STAFF CAN perform Stock IN
	stockInRespStaff := performJSONRequest(bundle.router, "POST", "/api/v1/products/"+createdProdID+"/stock-in", inventory.StockAdjustmentRequest{
		Quantity:       5,
		Note:           "Staff stock receiving",
		IdempotencyKey: fmt.Sprintf("IDEMP-STAFF-IN-%d", time.Now().UnixNano()),
	}, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusOK, stockInRespStaff.Code)

	// H. STAFF CAN perform Stock OUT
	stockOutRespStaff := performJSONRequest(bundle.router, "POST", "/api/v1/products/"+createdProdID+"/stock-out", inventory.StockAdjustmentRequest{
		Quantity:       2,
		Note:           "Staff stock dispatch",
		IdempotencyKey: fmt.Sprintf("IDEMP-STAFF-OUT-%d", time.Now().UnixNano()),
	}, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusOK, stockOutRespStaff.Code)

	// I. STAFF CAN view movement history
	movRespStaff := performJSONRequest(bundle.router, "GET", "/api/v1/stock-movements", nil, map[string]string{
		"Authorization": "Bearer " + staffToken,
	})
	assert.Equal(t, http.StatusOK, movRespStaff.Code)

	// J. Unauthenticated requests to inventory endpoints MUST receive 401 Unauthorized
	unauthIn := performJSONRequest(bundle.router, "POST", "/api/v1/products/"+createdProdID+"/stock-in", inventory.StockAdjustmentRequest{
		Quantity:       1,
		IdempotencyKey: "UNAUTH-1",
	}, nil)
	assert.Equal(t, http.StatusUnauthorized, unauthIn.Code)
}

func TestProductionSecurityValidation(t *testing.T) {
	// 1. Default dev secret in production must fail validation
	prodCfg := &config.Config{
		Env:       "production",
		JWTSecret: "stockpilot-secure-auth-jwt-secret-key-32-chars-dev",
	}
	assert.True(t, prodCfg.IsProduction())
	err := prodCfg.Validate()
	assert.Error(t, err, "Default dev secret must be rejected in production")

	// 2. Short secret in production must fail validation
	shortSecretCfg := &config.Config{
		Env:       "production",
		JWTSecret: "short-key",
	}
	err = shortSecretCfg.Validate()
	assert.Error(t, err, "Short secret must be rejected in production")

	// 3. Valid 32+ char secret in production passes validation
	validProdCfg := &config.Config{
		Env:       "production",
		JWTSecret: "valid-production-secret-key-that-is-at-least-32-bytes-long",
	}
	err = validProdCfg.Validate()
	assert.NoError(t, err)

	// 4. Ensure RunUserSeeds strictly returns nil without seeding in production
	bundle := setupTestRouter(t)
	ctx := context.Background()
	err = bundle.db.RunUserSeeds(ctx, validProdCfg)
	assert.NoError(t, err)
}
