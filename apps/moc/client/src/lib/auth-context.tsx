'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, refreshToken as apiRefreshToken, getMe } from './api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  secondary_roles?: string[];
  admin_access?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem('moc_auth');
    if (stored) {
      try {
        const { accessToken, refreshToken, user: storedUser } = JSON.parse(stored);
        setToken(accessToken);
        setUser(storedUser);
        // Verify token is still valid
        getMe(accessToken)
          .then((me) => setUser(me))
          .catch(async () => {
            // Try refresh
            try {
              const result = await apiRefreshToken(refreshToken);
              setToken(result.tokens.accessToken);
              const me = await getMe(result.tokens.accessToken);
              setUser(me);
              localStorage.setItem('moc_auth', JSON.stringify({
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                user: me,
              }));
            } catch {
              // Session expired
              localStorage.removeItem('moc_auth');
              setToken(null);
              setUser(null);
            }
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('moc_auth');
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
    localStorage.setItem('moc_auth', JSON.stringify({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user,
    }));
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('moc_auth');
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

/** Check if a user has admin-level access (role-based or granted via admin_access flag) */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return ['super_admin', 'admin', 'moc_manager'].includes(user.role) || user.admin_access === true;
}
