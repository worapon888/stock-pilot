import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_API_BASE_URL } from '../constants/config';

export const apiClient = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const updateApiClientBaseUrl = (newBaseUrl: string) => {
  apiClient.defaults.baseURL = newBaseUrl;
};

// Handlers for dynamic token injection and single-flight token refresh
let getAccessTokenFn: (() => string | null) | null = null;
let getRefreshTokenFn: (() => string | null) | null = null;
let onTokenRefreshedFn: ((newToken: string) => void) | null = null;
let onSessionExpiredFn: (() => void) | null = null;

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const configureAuthInterceptors = (config: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (newAccessToken: string, newRefreshToken: string) => void;
  onSessionExpired: () => void;
}) => {
  getAccessTokenFn = config.getAccessToken;
  getRefreshTokenFn = config.getRefreshToken;
  onTokenRefreshedFn = (token) => {};
  onSessionExpiredFn = config.onSessionExpired;
};

// Request interceptor: attach Authorization header
apiClient.interceptors.request.use(
  (reqConfig: InternalAxiosRequestConfig) => {
    if (getAccessTokenFn) {
      const token = getAccessTokenFn();
      if (token && !reqConfig.headers.Authorization) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: single-flight refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

    // Handle 401 Unauthorized for protected endpoints
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const refreshToken = getRefreshTokenFn ? getRefreshTokenFn() : null;
      if (!refreshToken) {
        if (onSessionExpiredFn) {
          onSessionExpiredFn();
        }
        return Promise.reject(error);
      }

      // Single-flight lock: avoid concurrent duplicate refresh requests
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            // Use clean isolated axios instance to avoid recursive interceptor loops
            const res = await axios.post(
              `${apiClient.defaults.baseURL}/auth/refresh`,
              { refresh_token: refreshToken },
              { timeout: 8000 }
            );

            const payload = res.data?.data;
            if (payload?.access_token && payload?.refresh_token) {
              if (onTokenRefreshedFn) {
                onTokenRefreshedFn(payload.access_token);
              }
              return payload.access_token as string;
            }
            return null;
          } catch (refreshErr: any) {
            // Only trigger session expiration if server confirmed invalid/revoked/expired token (401/403)
            // Do NOT log out on temporary network failure
            if (refreshErr.response?.status === 401 || refreshErr.response?.status === 403) {
              if (onSessionExpiredFn) {
                onSessionExpiredFn();
              }
            }
            return null;
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }
        })();
      }

      try {
        const newAccessToken = await refreshPromise;
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Fall through to reject
      }
    }

    return Promise.reject(error);
  }
);

export const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const serverError = error.response?.data?.error;
    if (serverError?.message) {
      if (serverError.details) {
        return `${serverError.message}: ${JSON.stringify(serverError.details)}`;
      }
      return serverError.message;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.code === 'ECONNABORTED') {
      return 'หมดเวลาเชื่อมต่อ กรุณาตรวจสอบเครือข่ายและเซิร์ฟเวอร์';
    }
    if (error.message && error.message.includes('Network Error')) {
      return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงานและ URL ถูกต้อง';
    }
    return error.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง';
};
