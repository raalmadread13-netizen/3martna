import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@/domain/entities/User';
import { authApi } from '@/infrastructure/api/authApi';
import { setSessionExpiredHandler, tokenStorage } from '@/infrastructure/api/client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session lifecycle:
 *  - auto-login on launch (restores tokens, fetches /auth/me — the API
 *    client transparently rotates the refresh token if the access token
 *    has expired)
 *  - reacts to session expiry signalled by the API client
 *  - stores tokens exclusively in encrypted SecureStore
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const clearSession = useCallback(async (): Promise<void> => {
    await tokenStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Auto-login on app launch
  useEffect(() => {
    let cancelled = false;
    const restore = async (): Promise<void> => {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const profile = await authApi.me();
        if (!cancelled) {
          setUser(profile);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) await clearSession();
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Refresh failure anywhere in the app ends the session
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void clearSession();
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(async (identifier: string, password: string): Promise<void> => {
    const result = await authApi.login(identifier, password);
    await tokenStorage.set(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber: string;
      password: string;
    }): Promise<void> => {
      const result = await authApi.register(input);
      await tokenStorage.set(result.tokens.accessToken, result.tokens.refreshToken);
      setUser(result.user);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = await tokenStorage.getRefresh();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined); // best-effort server revoke
    }
    await clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    setUser(await authApi.me());
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, refreshProfile }),
    [status, user, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
