import { AuthTokens, User } from '@/domain/entities/User';
import { api } from './client';

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export const authApi = {
  register: (body: {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber: string;
    password: string;
    preferredLanguage?: 'ar' | 'en';
  }) => api.post<{ data: AuthResult }>('/auth/register', body).then((r) => r.data.data),

  login: (identifier: string, password: string) =>
    api
      .post<{ data: AuthResult }>('/auth/login', { identifier, password })
      .then((r) => r.data.data),

  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),

  me: () => api.get<{ data: User }>('/auth/me').then((r) => r.data.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (identifier: string) =>
    api
      .post<{ message: string; data?: { devCode?: string } }>('/auth/forgot-password', {
        identifier,
      })
      .then((r) => r.data),

  resetPassword: (identifier: string, code: string, newPassword: string) =>
    api.post('/auth/reset-password', { identifier, code, newPassword }),

  requestVerification: (channel: 'email' | 'phone') =>
    api
      .post<{ data?: { devCode?: string } }>('/auth/verification/request', { channel })
      .then((r) => r.data),

  confirmVerification: (channel: 'email' | 'phone', code: string) =>
    api.post('/auth/verification/confirm', { channel, code }),
};
