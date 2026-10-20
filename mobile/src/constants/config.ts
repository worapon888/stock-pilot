import { Platform } from 'react-native';

export const DEFAULT_API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8080/api/v1',
  ios: 'http://localhost:8080/api/v1',
  default: 'http://localhost:8080/api/v1',
});

export const APP_CONFIG = {
  name: 'StockPilot',
  version: '1.0.0',
  defaultTimeout: 10000,
};
