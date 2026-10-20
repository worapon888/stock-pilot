package tests

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"stockpilot-backend/internal/config"
	"stockpilot-backend/internal/database"
	"stockpilot-backend/internal/inventory"
	"stockpilot-backend/internal/products"
)

func setupTestDB(t *testing.T) *database.DB {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg)
	require.NoError(t, err, "Failed to connect to test database")

	err = db.RunMigrations(ctx)
	require.NoError(t, err, "Failed to run migrations")

	return db
}

func TestProductCreationAndDuplicateSKU(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	repo := products.NewRepository(db.Pool)
	svc := products.NewService(repo)
	ctx := context.Background()

	uniqueSKU := fmt.Sprintf("TEST-%d", time.Now().UnixNano())
	req := products.CreateProductRequest{
		SKU:           uniqueSKU,
		Name:          "Test Mechanical Keyboard",
		Price:         129.99,
		StockQuantity: 50,
		MinStock:      10,
	}

	// 1. Successful product creation
	created, err := svc.CreateProduct(ctx, req)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, created.ID)
	assert.Equal(t, uniqueSKU, created.SKU)
	assert.Equal(t, 50, created.StockQuantity)

	// 2. Duplicate SKU rejection
	_, errDuplicate := svc.CreateProduct(ctx, req)
	assert.Error(t, errDuplicate)
	assert.ErrorIs(t, errDuplicate, products.ErrDuplicateSKU)
}

func TestStockInAndStockOut(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	prodRepo := products.NewRepository(db.Pool)
	prodSvc := products.NewService(prodRepo)
	invRepo := inventory.NewRepository(db.Pool)
	invSvc := inventory.NewService(invRepo)
	ctx := context.Background()

	// Create test product with initial 20 stock
	sku := fmt.Sprintf("FLOW-%d", time.Now().UnixNano())
	prod, err := prodSvc.CreateProduct(ctx, products.CreateProductRequest{
		SKU:           sku,
		Name:          "Stock Flow Item",
		Price:         50.00,
		StockQuantity: 20,
		MinStock:      5,
	})
	require.NoError(t, err)

	// 1. Stock IN (+15)
	idempIn := fmt.Sprintf("IDEMP-IN-%d", time.Now().UnixNano())
	inRes, err := invSvc.StockIn(ctx, prod.ID, inventory.StockAdjustmentRequest{
		Quantity:       15,
		Note:           "Restock shipment arrival",
		IdempotencyKey: idempIn,
	})
	require.NoError(t, err)
	assert.False(t, inRes.Replayed)
	assert.Equal(t, 20, inRes.PreviousStock)
	assert.Equal(t, 35, inRes.CurrentStock)
	assert.Equal(t, inventory.MovementTypeIn, inRes.Movement.Type)

	// 2. Stock OUT (-10)
	idempOut := fmt.Sprintf("IDEMP-OUT-%d", time.Now().UnixNano())
	outRes, err := invSvc.StockOut(ctx, prod.ID, inventory.StockAdjustmentRequest{
		Quantity:       10,
		Note:           "Fulfillment dispatch",
		IdempotencyKey: idempOut,
	})
	require.NoError(t, err)
	assert.False(t, outRes.Replayed)
	assert.Equal(t, 35, outRes.PreviousStock)
	assert.Equal(t, 25, outRes.CurrentStock)
	assert.Equal(t, inventory.MovementTypeOut, outRes.Movement.Type)

	// 3. Database persistence verification
	refreshed, err := prodSvc.GetProductByID(ctx, prod.ID)
	require.NoError(t, err)
	assert.Equal(t, 25, refreshed.StockQuantity)
}

func TestPreventNegativeStock(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	prodRepo := products.NewRepository(db.Pool)
	prodSvc := products.NewService(prodRepo)
	invRepo := inventory.NewRepository(db.Pool)
	invSvc := inventory.NewService(invRepo)
	ctx := context.Background()

	sku := fmt.Sprintf("NO-NEG-%d", time.Now().UnixNano())
	prod, err := prodSvc.CreateProduct(ctx, products.CreateProductRequest{
		SKU:           sku,
		Name:          "Limited Supply Item",
		Price:         10.00,
		StockQuantity: 5,
		MinStock:      2,
	})
	require.NoError(t, err)

	// Try to dispatch 10 units when only 5 exist
	idempKey := fmt.Sprintf("IDEMP-OVERSPEC-%d", time.Now().UnixNano())
	_, errOversell := invSvc.StockOut(ctx, prod.ID, inventory.StockAdjustmentRequest{
		Quantity:       10,
		Note:           "Excessive dispatch order",
		IdempotencyKey: idempKey,
	})

	assert.Error(t, errOversell)
	assert.ErrorIs(t, errOversell, inventory.ErrInsufficientStock)

	// Stock must remain unaffected (5)
	refreshed, err := prodSvc.GetProductByID(ctx, prod.ID)
	require.NoError(t, err)
	assert.Equal(t, 5, refreshed.StockQuantity)
}

func TestIdempotencyReplayAndConflict(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	prodRepo := products.NewRepository(db.Pool)
	prodSvc := products.NewService(prodRepo)
	invRepo := inventory.NewRepository(db.Pool)
	invSvc := inventory.NewService(invRepo)
	ctx := context.Background()

	sku := fmt.Sprintf("IDEMP-TEST-%d", time.Now().UnixNano())
	prod, err := prodSvc.CreateProduct(ctx, products.CreateProductRequest{
		SKU:           sku,
		Name:          "Idempotent Item",
		Price:         25.00,
		StockQuantity: 100,
		MinStock:      10,
	})
	require.NoError(t, err)

	idempKey := fmt.Sprintf("EXACT-KEY-%d", time.Now().UnixNano())
	req := inventory.StockAdjustmentRequest{
		Quantity:       20,
		Note:           "Batch movement",
		IdempotencyKey: idempKey,
	}

	// 1. Initial execution
	res1, err := invSvc.StockOut(ctx, prod.ID, req)
	require.NoError(t, err)
	assert.False(t, res1.Replayed)
	assert.Equal(t, 80, res1.CurrentStock)

	// 2. Exact repeated request with same key and payload -> must replay without modifying stock again
	res2, err := invSvc.StockOut(ctx, prod.ID, req)
	require.NoError(t, err)
	assert.True(t, res2.Replayed)
	assert.Equal(t, res1.Movement.ID, res2.Movement.ID)
	assert.Equal(t, 80, res2.CurrentStock)

	// Verify stock is still 80 in DB (did not decrease to 60)
	checkProd, err := prodSvc.GetProductByID(ctx, prod.ID)
	require.NoError(t, err)
	assert.Equal(t, 80, checkProd.StockQuantity)

	// 3. Reusing the SAME idempotency key with DIFFERENT payload -> must return ErrIdempotencyConflict
	conflictReq := inventory.StockAdjustmentRequest{
		Quantity:       50, // Different quantity!
		Note:           "Different payload",
		IdempotencyKey: idempKey,
	}
	_, errConflict := invSvc.StockOut(ctx, prod.ID, conflictReq)
	assert.Error(t, errConflict)
	assert.ErrorIs(t, errConflict, inventory.ErrIdempotencyConflict)
}

func TestConcurrentStockOperations(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	prodRepo := products.NewRepository(db.Pool)
	prodSvc := products.NewService(prodRepo)
	invRepo := inventory.NewRepository(db.Pool)
	invSvc := inventory.NewService(invRepo)
	ctx := context.Background()

	// Start with exactly 30 items
	sku := fmt.Sprintf("RACE-%d", time.Now().UnixNano())
	prod, err := prodSvc.CreateProduct(ctx, products.CreateProductRequest{
		SKU:           sku,
		Name:          "High Demand Flash Sale Item",
		Price:         99.00,
		StockQuantity: 30,
		MinStock:      5,
	})
	require.NoError(t, err)

	// Launch 10 concurrent goroutines, each attempting to buy 5 items (Total requested = 50, but only 30 available)
	// Exactly 6 must succeed (6 * 5 = 30), and 4 must fail with ErrInsufficientStock.
	var wg sync.WaitGroup
	successCount := 0
	failureCount := 0
	var mu sync.Mutex

	for i := 0; i < 10; i++ {
		wg.Add(1)
		goroutineID := i
		go func() {
			defer wg.Done()
			uniqueKey := fmt.Sprintf("CONCURRENT-%d-%d", goroutineID, time.Now().UnixNano())
			_, err := invSvc.StockOut(ctx, prod.ID, inventory.StockAdjustmentRequest{
				Quantity:       5,
				Note:           fmt.Sprintf("Concurrent order %d", goroutineID),
				IdempotencyKey: uniqueKey,
			})

			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successCount++
			} else {
				failureCount++
			}
		}()
	}

	wg.Wait()

	// Exactly 6 orders succeeded, remaining 4 rejected
	assert.Equal(t, 6, successCount, "Exactly 6 orders of 5 units should succeed for 30 units")
	assert.Equal(t, 4, failureCount, "Remaining 4 orders should fail due to insufficient stock")

	// Final stock in database must be exactly 0 (no oversell, no negative quantity)
	finalProd, err := prodSvc.GetProductByID(ctx, prod.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, finalProd.StockQuantity)
}
