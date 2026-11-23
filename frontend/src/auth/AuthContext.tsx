import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '../api/auth';
import { getToken, setToken } from '../api/client';
import { CurrentUser } from '../types/auth';
import { RolePermissions } from '../types/permissions';

interface AuthState {
  user: CurrentUser | null;
  permissions: RolePermissions | null;
  loading: boolean;
  // Returns the freshly-issued permissions directly — callers that need to
  // navigate immediately after login (e.g. to a role-appropriate landing
  // page) can't rely on the `permissions` from this context updating in
  // time, since that's an async state update on a separate render.
  login: (email: string, password: string) => Promise<RolePermissions>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPermissions(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('elevatohub:unauthorized', onUnauthorized);
    return () => window.removeEventListener('elevatohub:unauthorized', onUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.user);
        setPermissions(res.permissions);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.accessToken);
    setUser(res.user);
    setPermissions(res.permissions);
    return res.permissions;
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
