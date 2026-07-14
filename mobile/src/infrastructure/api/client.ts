import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/constants';
import { appStorage } from '@/infrastructure/storage/appStorage';

const API_BASE = `${env.apiUrl}/api/v1`;

/**
 * Central API client with automatic access-token attachment and
 * transparent refresh-token rotation: concurrent 401s share a single
 * refresh request, and a failed refresh signals session expiry.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  onSessionExpired = handler;
};

export const tokenStorage = {
  getAccess: () => appStorage.get(STORAGE_KEYS.accessToken),
  getRefresh: () => appStorage.get(STORAGE_KEYS.refreshToken),
  async set(accessToken: string, refreshToken: string): Promise<void> {
    await appStorage.set(STORAGE_KEYS.accessToken, accessToken);
    await appStorage.set(STORAGE_KEYS.refreshToken, refreshToken);
  },
  async clear(): Promise<void> {
    await appStorage.remove(STORAGE_KEYS.accessToken);
    await appStorage.remove(STORAGE_KEYS.refreshToken);
  },
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const refreshSession = async (): Promise<string | null> => {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    // Plain axios call — bypasses these interceptors to avoid recursion
    const response = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    const tokens = response.data?.data as { accessToken: string; refreshToken: string };
    await tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    return tokens.accessToken;
  } catch {
    await tokenStorage.clear();
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthRoute = original?.url?.includes('/auth/') && !original?.url?.includes('/auth/me');

    if (error.response?.status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      refreshPromise ??= refreshSession().finally(() => {
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

/** Display-safe message from an API error (uses the server envelope). */
export const apiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; details?: unknown } | undefined;
    if (data?.message) {
      const details = Array.isArray(data.details) ? ` (${data.details.join(', ')})` : '';
      return `${data.message}${details}`;
    }
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    if (!error.response) return 'Network error — check your connection';
  }
  return 'Something went wrong';
};
