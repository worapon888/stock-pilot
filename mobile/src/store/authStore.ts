import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthUser, LoginInput } from '../types';
import { authApi } from '../api/auth';
import { configureAuthInterceptors, extractErrorMessage } from '../api/client';

const SECURE_KEYS = {
  ACCESS_TOKEN: 'sp_sec_access_token',
  REFRESH_TOKEN: 'sp_sec_refresh_token',
  USER_DATA: 'sp_sec_user_profile',
};

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  authError: string | null;

  login: (credentials: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  refreshTokens: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  isRestoring: true,
  authError: null,

  clearError: () => set({ authError: null }),

  login: async (credentials: LoginInput): Promise<boolean> => {
    set({ isLoading: true, authError: null });
    try {
      const data = await authApi.login(credentials);

      // Save tokens and user session securely using expo-secure-store
      await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, data.access_token);
      await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, data.refresh_token);
      await SecureStore.setItemAsync(SECURE_KEYS.USER_DATA, JSON.stringify(data.user));

      set({
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      return true;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      set({
        isLoading: false,
        authError: msg,
      });
      return false;
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    // Invalidate refresh token on the server in background
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore server network errors on logout
      }
    }

    // Safely delete stored credentials from SecureStore
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(SECURE_KEYS.USER_DATA).catch(() => {}),
    ]);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
    });
  },

  restoreSession: async (): Promise<boolean> => {
    set({ isRestoring: true });
    try {
      const [savedAccess, savedRefresh, savedUserStr] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(SECURE_KEYS.USER_DATA),
      ]);

      if (!savedRefresh) {
        set({ isRestoring: false, isAuthenticated: false });
        return false;
      }

      let parsedUser: AuthUser | null = null;
      if (savedUserStr) {
        try {
          parsedUser = JSON.parse(savedUserStr);
        } catch {
          parsedUser = null;
        }
      }

      // Put saved credentials into state
      set({
        accessToken: savedAccess,
        refreshToken: savedRefresh,
        user: parsedUser,
      });

      // Verify or refresh session via API
      try {
        const refreshResult = await authApi.refresh(savedRefresh);

        await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, refreshResult.access_token);
        await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, refreshResult.refresh_token);

        set({
          accessToken: refreshResult.access_token,
          refreshToken: refreshResult.refresh_token,
        });

        // Fetch fresh profile
        const freshUser = await authApi.getMe();
        await SecureStore.setItemAsync(SECURE_KEYS.USER_DATA, JSON.stringify(freshUser));

        set({
          user: freshUser,
          isAuthenticated: true,
          isRestoring: false,
        });
        return true;
      } catch (verifyErr: any) {
        // If refresh failed with 401/403 (unauthorized/invalid token), session is truly expired
        const status = verifyErr.response?.status;
        if (status === 401 || status === 403) {
          await get().logout();
          set({ isRestoring: false });
          return false;
        }

        // For temporary network failure or server timeout, if we have a parsed user, keep session
        if (parsedUser) {
          set({
            isAuthenticated: true,
            isRestoring: false,
          });
          return true;
        }

        set({ isRestoring: false, isAuthenticated: false });
        return false;
      }
    } catch {
      set({ isRestoring: false, isAuthenticated: false });
      return false;
    }
  },

  refreshTokens: async (): Promise<boolean> => {
    const { refreshToken } = get();
    if (!refreshToken) {
      return false;
    }
    try {
      const data = await authApi.refresh(refreshToken);
      await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, data.access_token);
      await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, data.refresh_token);

      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
      });
      return true;
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        await get().logout();
      }
      return false;
    }
  },
}));

// Wire up client interceptors to access authStore state dynamically
configureAuthInterceptors({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokenRefreshed: async (newAccess, newRefresh) => {
    await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, newAccess);
    await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, newRefresh);
    useAuthStore.setState({ accessToken: newAccess, refreshToken: newRefresh });
  },
  onSessionExpired: () => {
    useAuthStore.getState().logout();
  },
});
