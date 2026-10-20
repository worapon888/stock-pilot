import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, StockMovement, DashboardSummary, CreateProductInput, UpdateProductInput, MovementType } from '../types';
import { productsApi } from '../api/products';
import { inventoryApi, generateUUID } from '../api/inventory';
import { dashboardApi } from '../api/dashboard';
import { extractErrorMessage } from '../api/client';
import { INITIAL_DEMO_PRODUCTS, INITIAL_DEMO_MOVEMENTS } from '../data/demoData';
import { useSettingsStore } from './settingsStore';

const STORAGE_KEYS = {
  DEMO_PRODUCTS: '@stockpilot_demo_products',
  DEMO_MOVEMENTS: '@stockpilot_demo_movements',
};

interface InventoryState {
  products: Product[];
  movements: StockMovement[];
  dashboard: DashboardSummary | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;

  // Actions
  fetchDashboard: () => Promise<void>;
  fetchProducts: (search?: string, filter?: string) => Promise<void>;
  fetchMovements: (productId?: string, type?: string) => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, input: UpdateProductInput) => Promise<Product>;
  adjustStock: (productId: string, type: MovementType, quantity: number, note: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
  clearError: () => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  movements: [],
  dashboard: null,
  isLoading: false,
  isMutating: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchDashboard: async () => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isLoading: true, error: null });

    try {
      if (isDemo) {
        // Compute demo metrics from AsyncStorage
        let prods: Product[] = [];
        let movs: StockMovement[] = [];

        const prodsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
        const movsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_MOVEMENTS);

        if (!prodsJson) {
          prods = INITIAL_DEMO_PRODUCTS;
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(prods));
        } else {
          prods = JSON.parse(prodsJson);
        }

        if (!movsJson) {
          movs = INITIAL_DEMO_MOVEMENTS;
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MOVEMENTS, JSON.stringify(movs));
        } else {
          movs = JSON.parse(movsJson);
        }

        const totalStock = prods.reduce((acc, p) => acc + p.stock_quantity, 0);
        const totalValue = prods.reduce((acc, p) => acc + p.stock_quantity * p.price, 0);
        const lowStockProds = prods.filter((p) => p.stock_quantity <= p.min_stock);

        set({
          products: prods,
          movements: movs,
          dashboard: {
            total_products: prods.length,
            total_stock: totalStock,
            total_value: totalValue,
            low_stock_count: lowStockProds.length,
            low_stock_products: lowStockProds.slice(0, 5),
            recent_movements: movs.slice(0, 6),
          },
          isLoading: false,
        });
      } else {
        // Fetch from Go REST API
        const summary = await dashboardApi.getSummary();
        set({ dashboard: summary, isLoading: false });
      }
    } catch (err) {
      set({ error: extractErrorMessage(err), isLoading: false });
    }
  },

  fetchProducts: async (search?: string, filter?: string) => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isLoading: true, error: null });

    try {
      if (isDemo) {
        let prods: Product[] = [];
        const prodsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
        if (!prodsJson) {
          prods = INITIAL_DEMO_PRODUCTS;
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(prods));
        } else {
          prods = JSON.parse(prodsJson);
        }

        let filtered = prods;
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
          );
        }

        if (filter === 'low_stock') {
          filtered = filtered.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock);
        } else if (filter === 'out_of_stock') {
          filtered = filtered.filter((p) => p.stock_quantity === 0);
        } else if (filter === 'in_stock') {
          filtered = filtered.filter((p) => p.stock_quantity > 0);
        }

        set({ products: filtered, isLoading: false });
      } else {
        const { products } = await productsApi.list({ search, filter });
        set({ products, isLoading: false });
      }
    } catch (err) {
      set({ error: extractErrorMessage(err), isLoading: false });
    }
  },

  fetchMovements: async (productId?: string, type?: string) => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isLoading: true, error: null });

    try {
      if (isDemo) {
        let movs: StockMovement[] = [];
        const movsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_MOVEMENTS);
        if (!movsJson) {
          movs = INITIAL_DEMO_MOVEMENTS;
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MOVEMENTS, JSON.stringify(movs));
        } else {
          movs = JSON.parse(movsJson);
        }

        let filtered = movs;
        if (productId) {
          filtered = filtered.filter((m) => m.product_id === productId);
        }
        if (type && type !== 'all') {
          filtered = filtered.filter((m) => m.type.toUpperCase() === type.toUpperCase());
        }

        // Sort desc
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        set({ movements: filtered, isLoading: false });
      } else {
        const { movements } = await inventoryApi.listMovements({ product_id: productId, type });
        set({ movements, isLoading: false });
      }
    } catch (err) {
      set({ error: extractErrorMessage(err), isLoading: false });
    }
  },

  createProduct: async (input: CreateProductInput): Promise<Product> => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isMutating: true, error: null });

    try {
      if (isDemo) {
        const prodsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
        const prods: Product[] = prodsJson ? JSON.parse(prodsJson) : INITIAL_DEMO_PRODUCTS;

        const skuExists = prods.some((p) => p.sku.toUpperCase() === input.sku.toUpperCase());
        if (skuExists) {
          throw new Error('A product with this SKU already exists');
        }

        const newProd: Product = {
          id: generateUUID(),
          sku: input.sku.toUpperCase(),
          name: input.name,
          price: input.price,
          stock_quantity: input.stock_quantity,
          min_stock: input.min_stock,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updated = [newProd, ...prods];
        await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(updated));

        // If initial stock > 0, log initial movement
        if (input.stock_quantity > 0) {
          const movsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_MOVEMENTS);
          const movs: StockMovement[] = movsJson ? JSON.parse(movsJson) : INITIAL_DEMO_MOVEMENTS;
          const initialMovement: StockMovement = {
            id: generateUUID(),
            product_id: newProd.id,
            product_name: newProd.name,
            product_sku: newProd.sku,
            type: 'IN',
            quantity: input.stock_quantity,
            note: 'Initial stock intake',
            idempotency_key: generateUUID(),
            created_at: new Date().toISOString(),
          };
          await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MOVEMENTS, JSON.stringify([initialMovement, ...movs]));
        }

        set({ products: updated, isMutating: false });
        await get().fetchDashboard();
        return newProd;
      } else {
        const created = await productsApi.create(input);
        set({ isMutating: false });
        await get().fetchProducts();
        await get().fetchDashboard();
        return created;
      }
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ error: msg, isMutating: false });
      throw new Error(msg);
    }
  },

  updateProduct: async (id: string, input: UpdateProductInput): Promise<Product> => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isMutating: true, error: null });

    try {
      if (isDemo) {
        const prodsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
        const prods: Product[] = prodsJson ? JSON.parse(prodsJson) : INITIAL_DEMO_PRODUCTS;

        const index = prods.findIndex((p) => p.id === id);
        if (index === -1) {
          throw new Error('Product not found');
        }

        if (input.sku) {
          const skuExists = prods.some((p) => p.id !== id && p.sku.toUpperCase() === input.sku!.toUpperCase());
          if (skuExists) {
            throw new Error('Another product with this SKU already exists');
          }
        }

        const existing = prods[index];
        const updatedProd: Product = {
          ...existing,
          name: input.name ?? existing.name,
          sku: input.sku ? input.sku.toUpperCase() : existing.sku,
          price: input.price ?? existing.price,
          min_stock: input.min_stock ?? existing.min_stock,
          updated_at: new Date().toISOString(),
        };

        prods[index] = updatedProd;
        await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(prods));

        set({ products: [...prods], isMutating: false });
        await get().fetchDashboard();
        return updatedProd;
      } else {
        const updated = await productsApi.update(id, input);
        set({ isMutating: false });
        await get().fetchProducts();
        await get().fetchDashboard();
        return updated;
      }
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ error: msg, isMutating: false });
      throw new Error(msg);
    }
  },

  adjustStock: async (productId: string, type: MovementType, quantity: number, note: string) => {
    const isDemo = useSettingsStore.getState().isDemoMode;
    set({ isMutating: true, error: null });

    try {
      if (isDemo) {
        const prodsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
        const prods: Product[] = prodsJson ? JSON.parse(prodsJson) : INITIAL_DEMO_PRODUCTS;

        const prod = prods.find((p) => p.id === productId);
        if (!prod) {
          throw new Error('Product not found');
        }

        if (quantity <= 0) {
          throw new Error('Quantity must be greater than zero');
        }

        if (type === 'OUT' && prod.stock_quantity < quantity) {
          throw new Error(`Insufficient stock: available ${prod.stock_quantity}, requested ${quantity}`);
        }

        const newStock = type === 'IN' ? prod.stock_quantity + quantity : prod.stock_quantity - quantity;
        prod.stock_quantity = newStock;
        prod.updated_at = new Date().toISOString();

        await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(prods));

        // Add movement
        const movsJson = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_MOVEMENTS);
        const movs: StockMovement[] = movsJson ? JSON.parse(movsJson) : INITIAL_DEMO_MOVEMENTS;

        const newMovement: StockMovement = {
          id: generateUUID(),
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          type,
          quantity,
          note: note.trim(),
          idempotency_key: generateUUID(),
          created_at: new Date().toISOString(),
        };

        const updatedMovs = [newMovement, ...movs];
        await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MOVEMENTS, JSON.stringify(updatedMovs));

        set({
          products: [...prods],
          movements: updatedMovs,
          isMutating: false,
        });

        await get().fetchDashboard();
      } else {
        const idempotencyKey = generateUUID();
        if (type === 'IN') {
          await inventoryApi.stockIn(productId, { quantity, note, idempotency_key: idempotencyKey });
        } else {
          await inventoryApi.stockOut(productId, { quantity, note, idempotency_key: idempotencyKey });
        }

        set({ isMutating: false });
        await get().fetchDashboard();
        await get().fetchProducts();
        await get().fetchMovements();
      }
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ error: msg, isMutating: false });
      throw new Error(msg);
    }
  },

  resetDemoData: async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(INITIAL_DEMO_PRODUCTS));
    await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MOVEMENTS, JSON.stringify(INITIAL_DEMO_MOVEMENTS));
    await get().fetchDashboard();
  },
}));
