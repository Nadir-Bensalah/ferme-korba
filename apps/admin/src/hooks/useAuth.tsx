import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '@/lib/data';

export type Admin = { id: string; email: string; name: string };

interface AuthApi {
  status: 'loading' | 'out' | 'in';
  admin: Admin | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthApi['status']>('loading');
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    let alive = true;
    auth
      .currentAdmin()
      .then((a) => {
        if (!alive) return;
        setAdmin(a);
        setStatus(a ? 'in' : 'out');
      })
      .catch(() => {
        if (alive) setStatus('out');
      });
    const off = auth.onAuthChange((a) => {
      setAdmin(a);
      setStatus(a ? 'in' : 'out');
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const a = await auth.login({ email, password });
    setAdmin(a);
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setAdmin(null);
    setStatus('out');
  }, []);

  const api = useMemo<AuthApi>(() => ({ status, admin, login, logout }), [status, admin, login, logout]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('AuthProvider manquant');
  return api;
}
