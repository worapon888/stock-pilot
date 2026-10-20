import { apiClient } from './client';
import { StockMovement, StockAdjustmentInput, StockAdjustmentResult, ApiResponse, PaginationMeta } from '../types';

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const inventoryApi = {
  stockIn: async (productId: string, input: StockAdjustmentInput): Promise<StockAdjustmentResult> => {
    const idempotencyKey = input.idempotency_key || generateUUID();
    const response = await apiClient.post<ApiResponse<StockAdjustmentResult>>(
      `/products/${productId}/stock-in`,
      {
        quantity: input.quantity,
        note: input.note,
        idempotency_key: idempotencyKey,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    if (!response.data.data) {
      throw new Error('Stock-in response data missing');
    }
    return response.data.data;
  },

  stockOut: async (productId: string, input: StockAdjustmentInput): Promise<StockAdjustmentResult> => {
    const idempotencyKey = input.idempotency_key || generateUUID();
    const response = await apiClient.post<ApiResponse<StockAdjustmentResult>>(
      `/products/${productId}/stock-out`,
      {
        quantity: input.quantity,
        note: input.note,
        idempotency_key: idempotencyKey,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    if (!response.data.data) {
      throw new Error('Stock-out response data missing');
    }
    return response.data.data;
  },

  listMovements: async (params?: { product_id?: string; type?: string; page?: number; page_size?: number }): Promise<{ movements: StockMovement[]; meta?: PaginationMeta }> => {
    const response = await apiClient.get<ApiResponse<StockMovement[]>>('/stock-movements', { params });
    return {
      movements: response.data.data || [],
      meta: response.data.meta,
    };
  },

  getProductMovements: async (productId: string, page = 1, pageSize = 20): Promise<{ movements: StockMovement[]; meta?: PaginationMeta }> => {
    const response = await apiClient.get<ApiResponse<StockMovement[]>>(`/products/${productId}/movements`, {
      params: { page, page_size: pageSize },
    });
    return {
      movements: response.data.data || [],
      meta: response.data.meta,
    };
  },
};
