'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from './api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'complaint_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });

  // Restore from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user, accessToken, refreshToken } = JSON.parse(stored);
        setState({ user, accessToken, refreshToken, isLoading: false });
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    } catch {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  // SSO landing pages dispatch this after writing the session to
  // localStorage. Without the listener, the post-SSO navigation lands on
  // a page whose auth guard sees user=null (initial mount happened before
  // SSO exchange finished) and bounces to /login. A page refresh used to
  // work around it; this listener removes the need.
  useEffect(() => {
    function onAuthRefreshed(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.user && detail?.accessToken) {
        setState({
          user: detail.user,
          accessToken: detail.accessToken,
          refreshToken: detail.refreshToken || null,
          isLoading: false,
        });
      }
    }
    window.addEventListener('complaint:auth-refreshed', onAuthRefreshed);
    return () => window.removeEventListener('complaint:auth-refreshed', onAuthRefreshed);
  }, []);

  // Persist to localStorage
  const persist = useCallback((user: User | null, accessToken: string | null, refreshToken: string | null) => {
    if (user && accessToken) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Auto-refresh token
  useEffect(() => {
    if (!state.refreshToken) return;

    const refreshInterval = setInterval(async () => {
      try {
        const result = await authApi.refresh(state.refreshToken!);
        const newTokens = result.tokens;
        setState(s => ({
          ...s,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        }));
        persist(state.user, newTokens.accessToken, newTokens.refreshToken);
      } catch {
        // Refresh failed, log out
        setState({ user: null, accessToken: null, refreshToken: null, isLoading: false });
        persist(null, null, null);
      }
    }, 13 * 60 * 1000); // Refresh every 13 minutes (token expires in 15)

    return () => clearInterval(refreshInterval);
  }, [state.refreshToken, state.user, persist]);

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    const { user, tokens } = result;
    setState({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isLoading: false });
    persist(user, tokens.accessToken, tokens.refreshToken);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    setState({ user: null, accessToken: null, refreshToken: null, isLoading: false });
    persist(null, null, null);
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
