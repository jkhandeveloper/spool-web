import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshTokens, setSignedOutHandler, setTokens } from './api';
import type { User } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  /** Clears this browser's session only; the mobile app stays signed in. */
  signOut: () => void;
  /** Revokes every refresh token for the account (all devices). */
  signOutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(() => {
    setTokens(null);
    setUser(null);
    setStatus('signedOut');
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setSignedOutHandler(signOut);
    return () => setSignedOutHandler(null);
  }, [signOut]);

  // Restore a session from the stored refresh token on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await refreshTokens())) throw new Error('no session');
        const me = await api.me();
        if (!cancelled) {
          setUser(me);
          setStatus('signedIn');
        }
      } catch {
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const tokens = await api.login(email, password);
    setTokens(tokens, remember);
    const me = await api.me();
    setUser(me);
    setStatus('signedIn');
  }, []);

  const signOutEverywhere = useCallback(async () => {
    try {
      await api.logoutEverywhere();
    } finally {
      signOut();
    }
  }, [signOut]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, signOutEverywhere }),
    [status, user, signIn, signOut, signOutEverywhere],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
