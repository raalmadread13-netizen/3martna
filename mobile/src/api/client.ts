import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, STORAGE_KEYS } from '../config/constants';

/**
 * Axios client with automatic access-token attachment and transparent
 * refresh-token rotation. Concurrent 401s share a single refresh request.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: () => void): void => {
  onSessionExpired = handler;
};

export const tokenStore = {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, refreshToken);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken);
  },
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStore.get(STORAGE_KEYS.accessToken);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const refreshTokens = async (): Promise<string | null> => {
  const refreshToken = await tokenStore.get(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return null;
  try {
    // Plain axios: bypass interceptors to avoid recursion
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const tokens = response.data?.data as { accessToken: string; refreshToken: string };
    await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens.accessToken;
  } catch {
    await tokenStore.clear();
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const isAuthRoute = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && !original?._retried && !isAuthRoute) {
      original._retried = true;
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Extract a display message from an API error. */
export const apiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    if (!error.response) return 'Network error — check your connection';
  }
  return 'Something went wrong';
};
