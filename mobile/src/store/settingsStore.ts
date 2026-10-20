import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE_URL } from '../constants/config';
import { updateApiClientBaseUrl } from '../api/client';

interface SettingsState {
  isDemoMode: boolean;
  apiBaseUrl: string;
  isInitialized: boolean;
  setDemoMode: (isDemo: boolean) => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  initSettings: () => Promise<void>;
}

const STORAGE_KEYS = {
  DEMO_MODE: '@stockpilot_demo_mode',
  API_BASE_URL: '@stockpilot_api_base_url',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isDemoMode: false, // Default to connecting with the Go API backend
  apiBaseUrl: DEFAULT_API_BASE_URL || 'http://10.0.2.2:8080/api/v1',
  isInitialized: false,

  initSettings: async () => {
    try {
      const storedDemo = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_MODE);
      const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);

      const isDemo = storedDemo !== null ? storedDemo === 'true' : false;
      const url = storedUrl || DEFAULT_API_BASE_URL || 'http://10.0.2.2:8080/api/v1';

      updateApiClientBaseUrl(url);

      set({
        isDemoMode: isDemo,
        apiBaseUrl: url,
        isInitialized: true,
      });
    } catch {
      set({ isInitialized: true });
    }
  },

  setDemoMode: async (isDemo: boolean) => {
    set({ isDemoMode: isDemo });
    await AsyncStorage.setItem(STORAGE_KEYS.DEMO_MODE, isDemo ? 'true' : 'false');
  },

  setApiBaseUrl: async (url: string) => {
    const trimmed = url.trim();
    updateApiClientBaseUrl(trimmed);
    set({ apiBaseUrl: trimmed });
    await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, trimmed);
  },
}));
