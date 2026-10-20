import { apiClient } from './client';
import {
  ApiResponse,
  AuthUser,
  LoginInput,
  LoginResponseData,
  RefreshResponseData,
} from '../types';

export const authApi = {
  login: async (credentials: LoginInput): Promise<LoginResponseData> => {
    const res = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', credentials);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    return res.data.data;
  },

  refresh: async (refreshToken: string): Promise<RefreshResponseData> => {
    const res = await apiClient.post<ApiResponse<RefreshResponseData>>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'ต่ออายุเซสชันไม่สำเร็จ');
    }
    return res.data.data;
  },

  logout: async (refreshToken?: string | null): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {
        refresh_token: refreshToken || '',
      });
    } catch {
      // Best effort server revocation
    }
  },

  getMe: async (): Promise<AuthUser> => {
    const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'ไม่สามารถดึงข้อมูลผู้ใช้ได้');
    }
    return res.data.data;
  },
};
