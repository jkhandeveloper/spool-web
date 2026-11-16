import { useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { API_URL } from './config';
import type { AdminOverview, AdminUserDetail, AdminUserRow } from './analytics-types';

// Admin token: sessionStorage only (cleared when the tab closes), separate from
// the user's tokens. It expires server-side after ADMIN_TOKEN_TTL (default 8h).
const KEY = 'spool.adminToken';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
let token: string | null = read();

function setToken(t: string | null) {
  token = t;
  try {
    if (t) sessionStorage.setItem(KEY, t);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: token stays in memory */
  }
  listeners.forEach((l) => l());
}

export function useAdminToken() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => token,
  );
}

export const adminSignOut = () => setToken(null);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach Spool. Check your connection.', 0);
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && path !== '/admin/login') setToken(null);
    const m = data && typeof data === 'object' && 'message' in data ? (data as { message: unknown }).message : null;
    const msg = Array.isArray(m) ? m.join('\n') : typeof m === 'string' ? m : res.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Something went wrong.';
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

function qs(params: Record<string, string | number | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}

export const adminApi = {
  async login(username: string, password: string) {
    const res = await request<{ accessToken: string }>('POST', '/admin/login', { username, password });
    setToken(res.accessToken);
  },
  overview: (days: number, tz: string) => request<AdminOverview>('GET', `/admin/analytics${qs({ days, tz })}`),
  users: (p: { search?: string; sort?: string; order?: string; limit: number; offset: number }) =>
    request<{ items: AdminUserRow[]; total: number }>('GET', `/admin/users${qs(p)}`),
  user: (id: string, days: number, tz: string) => request<AdminUserDetail>('GET', `/admin/users/${id}${qs({ days, tz })}`),
  deleteUser: (id: string) => request<void>('DELETE', `/admin/users/${id}`),
  setUserEnabled: (id: string, enabled: boolean) => request<{ enabled: boolean }>('PATCH', `/admin/users/${id}/status`, { enabled }),
};
