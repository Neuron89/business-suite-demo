'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PortalEmployee } from '@portal/shared';
import { getMe, login as apiLogin, loginDemo as apiLoginDemo, type DemoRole } from './api';

interface AuthContextValue {
  employee: PortalEmployee | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PortalEmployee>;
  loginDemo: (role: DemoRole) => Promise<PortalEmployee>;
  /**
   * Drop a pre-authenticated session into the context — used by the
   * Microsoft OAuth callback after the server has already minted a JWT.
   */
  adoptSession: (token: string, employee: PortalEmployee) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  employee: null,
  token: null,
  loading: true,
  login: async () => {
    throw new Error('AuthProvider missing');
  },
  loginDemo: async () => {
    throw new Error('AuthProvider missing');
  },
  adoptSession: () => {},
  logout: () => {},
  refresh: async () => {},
});

const STORAGE_KEY = 'acme_portal_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<PortalEmployee | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as { token: string; employee: PortalEmployee };
      setToken(parsed.token);
      setEmployee(parsed.employee);
      getMe(parsed.token)
        .then((res) => {
          setEmployee(res.employee);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: parsed.token, employee: res.employee }));
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setEmployee(null);
        })
        .finally(() => setLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setEmployee(res.employee);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    return res.employee;
  }, []);

  const loginDemo = useCallback(async (role: DemoRole) => {
    const res = await apiLoginDemo(role);
    setToken(res.token);
    setEmployee(res.employee);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    return res.employee;
  }, []);

  const adoptSession = useCallback((newToken: string, newEmployee: PortalEmployee) => {
    setToken(newToken);
    setEmployee(newEmployee);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, employee: newEmployee }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setEmployee(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMe(token);
      setEmployee(res.employee);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, employee: res.employee }));
    } catch {
      logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ employee, token, loading, login, loginDemo, adoptSession, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
