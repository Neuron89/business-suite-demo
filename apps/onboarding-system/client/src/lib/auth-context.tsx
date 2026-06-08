'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, refreshToken as apiRefreshToken, getMe } from './api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string;
  manager_id: number | null;
  manager_name: string;
  manager_email: string;
  is_test?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, loading: true,
  login: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // SSO landing page dispatches this after writing the session to
  // localStorage so the destination page sees a logged-in state on first
  // render and doesn't bounce to /login.
  useEffect(() => {
    function onAuthRefreshed(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.user && detail?.accessToken) {
        setToken(detail.accessToken);
        setUser(detail.user);
        setLoading(false);
      }
    }
    window.addEventListener('onb:auth-refreshed', onAuthRefreshed);
    return () => window.removeEventListener('onb:auth-refreshed', onAuthRefreshed);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('onb_auth');
    if (stored) {
      try {
        const { accessToken, refreshToken, user: storedUser } = JSON.parse(stored);
        setToken(accessToken);
        setUser(storedUser);
        getMe(accessToken)
          .then((me) => setUser(me))
          .catch(async () => {
            try {
              const result = await apiRefreshToken(refreshToken);
              setToken(result.tokens.accessToken);
              const me = await getMe(result.tokens.accessToken);
              setUser(me);
              localStorage.setItem('onb_auth', JSON.stringify({
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                user: me,
              }));
            } catch {
              localStorage.removeItem('onb_auth');
              setToken(null);
              setUser(null);
            }
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('onb_auth');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setUser(result.user);
    setToken(result.tokens.accessToken);
    localStorage.setItem('onb_auth', JSON.stringify({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user,
    }));
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try { await apiLogout(token); } catch {}
    }
    localStorage.removeItem('onb_auth');
    setUser(null);
    setToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
