import { apiClient } from './client';
import { Product, ApiResponse, CreateProductInput, UpdateProductInput, PaginationMeta } from '../types';

export const productsApi = {
  list: async (params?: { search?: string; filter?: string; page?: number; page_size?: number }): Promise<{ products: Product[]; meta?: PaginationMeta }> => {
    const response = await apiClient.get<ApiResponse<Product[]>>('/products', { params });
    return {
      products: response.data.data || [],
      meta: response.data.meta,
    };
  },

  getById: async (id: string): Promise<Product> => {
    const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    if (!response.data.data) {
      throw new Error('Product data missing');
    }
    return response.data.data;
  },

  create: async (data: CreateProductInput): Promise<Product> => {
    const response = await apiClient.post<ApiResponse<Product>>('/products', data);
    if (!response.data.data) {
      throw new Error('Created product data missing');
    }
    return response.data.data;
  },

  update: async (id: string, data: UpdateProductInput): Promise<Product> => {
    const response = await apiClient.patch<ApiResponse<Product>>(`/products/${id}`, data);
    if (!response.data.data) {
      throw new Error('Updated product data missing');
    }
    return response.data.data;
  },
};
