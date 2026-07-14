import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/constants';
import { appStorage } from '@/infrastructure/storage/appStorage';

/**
 * Central API client. Attaches the access token automatically and, once
 * the auth feature lands, will transparently rotate refresh tokens on 401.
 */
export const api: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await appStorage.get(STORAGE_KEYS.accessToken);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Extract a display-safe message from an API error. */
export const apiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = (error as AxiosError).response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    if (!error.response) return 'Network error — check your connection';
  }
  return 'Something went wrong';
};
