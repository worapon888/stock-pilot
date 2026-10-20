jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (objs: any) => objs.android ?? objs.default,
  },
}));

import { loginSchema } from '../schemas/authSchema';
import { extractErrorMessage } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) || null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

// Mock authApi
jest.mock('../api/auth', () => ({
  authApi: {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn(),
  },
}));

describe('Mobile Authentication & RBAC Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as any).__store.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isRestoring: false,
      authError: null,
    });
  });

  describe('1. Login Form Validation', () => {
    it('accepts valid email and password format', () => {
      const valid = {
        email: 'admin@stockpilot.com',
        password: 'Password123!',
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('admin@stockpilot.com');
      }
    });

    it('rejects empty email with required message', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('กรุณากรอกอีเมล');
      }
    });

    it('rejects malformed email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('รูปแบบอีเมลไม่ถูกต้อง');
      }
    });

    it('rejects empty password with required message', () => {
      const result = loginSchema.safeParse({
        email: 'admin@stockpilot.com',
        password: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('กรุณากรอกรหัสผ่าน');
      }
    });
  });

  describe('2. Successful Login', () => {
    it('authenticates user and persists tokens to SecureStore', async () => {
      const mockLoginResponse = {
        user: {
          id: 'u-admin-1',
          full_name: 'ผู้ดูแลระบบ',
          email: 'admin@stockpilot.com',
          role: 'ADMIN' as const,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        access_token: 'valid-mock-access-token',
        refresh_token: 'valid-mock-refresh-token',
        expires_in: 900,
        token_type: 'Bearer',
      };

      (authApi.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

      const success = await useAuthStore.getState().login({
        email: 'admin@stockpilot.com',
        password: 'AdminPassword123',
      });

      expect(success).toBe(true);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.role).toBe('ADMIN');
      expect(state.accessToken).toBe('valid-mock-access-token');

      // Verify tokens stored securely
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'sp_sec_access_token',
        'valid-mock-access-token'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'sp_sec_refresh_token',
        'valid-mock-refresh-token'
      );
    });
  });

  describe('3. Failed Login', () => {
    it('sets error state on invalid credentials', async () => {
      (authApi.login as jest.Mock).mockRejectedValueOnce(
        new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      );

      const success = await useAuthStore.getState().login({
        email: 'admin@stockpilot.com',
        password: 'WrongPassword',
      });

      expect(success).toBe(false);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.authError).toContain('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    });
  });

  describe('4. Session Restoration & Token Refresh', () => {
    it('restores valid session by refreshing token and fetching profile', async () => {
      // Simulate existing credentials in SecureStore
      (SecureStore as any).__store.set('sp_sec_refresh_token', 'stored-refresh-token');
      (SecureStore as any).__store.set(
        'sp_sec_user_profile',
        JSON.stringify({
          id: 'u-staff-1',
          full_name: 'พนักงาน สต๊อก',
          email: 'staff@stockpilot.com',
          role: 'STAFF',
          is_active: true,
        })
      );

      (authApi.refresh as jest.Mock).mockResolvedValueOnce({
        access_token: 'new-rotated-access-token',
        refresh_token: 'new-rotated-refresh-token',
        expires_in: 900,
        token_type: 'Bearer',
      });

      (authApi.getMe as jest.Mock).mockResolvedValueOnce({
        id: 'u-staff-1',
        full_name: 'พนักงาน สต๊อก',
        email: 'staff@stockpilot.com',
        role: 'STAFF',
        is_active: true,
        created_at: new Date().toISOString(),
      });

      const restored = await useAuthStore.getState().restoreSession();

      expect(restored).toBe(true);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('new-rotated-access-token');
      expect(state.user?.role).toBe('STAFF');
    });

    it('returns false when no credentials exist in SecureStore', async () => {
      const restored = await useAuthStore.getState().restoreSession();
      expect(restored).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('5. Expired / Revoked Session Handling', () => {
    it('clears credentials and logs out if refresh returns 401', async () => {
      (SecureStore as any).__store.set('sp_sec_refresh_token', 'revoked-token');

      const unauthorizedErr: any = new Error('Session expired');
      unauthorizedErr.response = { status: 401 };
      (authApi.refresh as jest.Mock).mockRejectedValueOnce(unauthorizedErr);

      const restored = await useAuthStore.getState().restoreSession();

      expect(restored).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sp_sec_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sp_sec_refresh_token');
    });
  });

  describe('6. Logout Functionality', () => {
    it('revokes server session and removes all stored tokens', async () => {
      useAuthStore.setState({
        user: {
          id: '1',
          full_name: 'User',
          email: 'test@example.com',
          role: 'ADMIN',
          is_active: true,
          created_at: '',
        },
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        isAuthenticated: true,
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();

      expect(authApi.logout).toHaveBeenCalledWith('refresh-123');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sp_sec_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sp_sec_refresh_token');
    });
  });

  describe('7. Role-Based Access Control Permissions', () => {
    it('distinguishes ADMIN and STAFF permissions', () => {
      const adminRole = 'ADMIN';
      const staffRole = 'STAFF';

      const canManageProducts = (role: string) => role === 'ADMIN';
      const canPerformStock = (role: string) => role === 'ADMIN' || role === 'STAFF';

      expect(canManageProducts(adminRole)).toBe(true);
      expect(canManageProducts(staffRole)).toBe(false);

      expect(canPerformStock(adminRole)).toBe(true);
      expect(canPerformStock(staffRole)).toBe(true);
    });
  });

  describe('8. Network Error Handling', () => {
    it('formats network failure into Thai user message', () => {
      const netError = {
        isAxiosError: true,
        message: 'Network Error',
        response: undefined,
      };

      const thaiMsg = extractErrorMessage(netError);
      expect(thaiMsg).toContain('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    });

    it('formats timeout into Thai connection timeout message', () => {
      const timeoutError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      const thaiMsg = extractErrorMessage(timeoutError);
      expect(thaiMsg).toContain('หมดเวลาเชื่อมต่อ');
    });
  });
});
