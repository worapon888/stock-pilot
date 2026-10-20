export type MovementType = 'IN' | 'OUT';

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock_quantity: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  type: MovementType;
  quantity: number;
  note: string;
  idempotency_key: string;
  created_at: string;
}

export interface DashboardSummary {
  total_products: number;
  total_stock: number;
  total_value: number;
  low_stock_count: number;
  low_stock_products: Product[];
  recent_movements: StockMovement[];
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CreateProductInput {
  sku: string;
  name: string;
  price: number;
  stock_quantity: number;
  min_stock: number;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  price?: number;
  min_stock?: number;
}

export interface StockAdjustmentInput {
  quantity: number;
  note: string;
  idempotency_key?: string;
}

export interface StockAdjustmentResult {
  movement: StockMovement;
  current_stock: number;
  previous_stock: number;
  replayed: boolean;
}

export type UserRole = 'ADMIN' | 'STAFF';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponseData {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface RefreshResponseData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
