import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, patch } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = sedang memuat

  const refresh = useCallback(async () => {
    try {
      const r = await get('/auth/me');
      setUser(r.user);
      return r.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    user,
    loading: user === undefined,
    setUser,
    refresh,
    async login(email, password) {
      const r = await post('/auth/login', { email, password });
      setUser(r.user);
      return r.user;
    },
    async register(email, password, display_name) {
      const r = await post('/auth/register', { email, password, display_name });
      setUser(r.user);
      return r.user;
    },
    async logout() {
      await post('/auth/logout').catch(() => {});
      setUser(null);
    },
    async updateProfile(changes) {
      const r = await patch('/me/profile', changes);
      setUser(r.user);
      return r.user;
    },
  }), [user, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export const isStaff = (u) => u && (u.role === 'owner' || u.role === 'contributor');
