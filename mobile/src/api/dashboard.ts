import { apiClient } from './client';
import { DashboardSummary, ApiResponse } from '../types';

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary');
    if (!response.data.data) {
      throw new Error('Dashboard summary data missing');
    }
    return response.data.data;
  },

  checkHealth: async (): Promise<{ status: string; database: string }> => {
    const response = await apiClient.get<ApiResponse<{ status: string; database: string }>>('/health');
    return response.data.data || { status: 'unknown', database: 'unknown' };
  },
};
