import { API_URL } from './config';
import { tokenStore } from './token-store';
import type {
  Appointment,
  Goal,
  JournalEntry,
  Meditation,
  TherapySession,
  Today,
  TokenPair,
  User,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: (() => void) | null = null;

/** Registered by AuthProvider so an expired session returns the user to sign-in. */
export function setSignedOutHandler(handler: (() => void) | null) {
  onSignedOut = handler;
}

export function setTokens(tokens: TokenPair | null, remember?: boolean) {
  accessToken = tokens?.accessToken ?? null;
  if (tokens) tokenStore.set(tokens.refreshToken, remember);
  else tokenStore.clear();
}

/** Exchanges the stored refresh token for new tokens. Concurrent callers share one request. */
export function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = tokenStore.get();
      if (!refreshToken) return false;
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        throw new ApiError('Could not reach Spool. Check your connection.', 0);
      }
      if (res.status === 401) {
        setTokens(null);
        return false;
      }
      if (!res.ok) throw new ApiError('Could not refresh session', res.status);
      setTokens((await res.json()) as TokenPair);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('\n');
    if (typeof m === 'string') return m;
  }
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Something went wrong. Please try again.';
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach Spool. Check your connection.', 0);
  }

  if (res.status === 401 && !path.startsWith('/auth/') && !retried) {
    if (await refreshTokens()) return request<T>(method, path, body, true);
    onSignedOut?.();
    throw new ApiError('Your session has ended. Please sign in again.', 401);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status);
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);

function qs(params: Record<string, string | number | boolean | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}

export const api = {
  login: (email: string, password: string) => post<TokenPair>('/auth/login', { email, password }),
  /** Revokes every refresh token for the account, including the mobile app's. */
  logoutEverywhere: () => post<void>('/auth/logout'),

  me: () => get<User>('/me'),
  exportData: () => get<unknown>('/me/export'),
  today: () => get<Today>(`/today${qs({ hour: new Date().getHours() })}`),

  journal: (limit = 20, offset = 0) =>
    get<{ items: JournalEntry[]; total: number }>(`/journal${qs({ limit, offset })}`),
  journalEntry: (id: string) => get<JournalEntry>(`/journal/${id}`),

  sessions: () => get<TherapySession[]>('/sessions'),
  pendingSessions: () => get<TherapySession[]>('/sessions/pending'),
  session: (id: string) => get<TherapySession>(`/sessions/${id}`),

  goals: (all = false) => get<Goal[]>(`/goals${qs({ all: all || undefined })}`),
  goal: (id: string) => get<Goal>(`/goals/${id}`),

  appointments: (from: Date, to: Date) =>
    get<Appointment[]>(`/appointments${qs({ from: from.toISOString(), to: to.toISOString() })}`),
  appointment: (id: string) => get<Appointment>(`/appointments/${id}`),

  meditations: () => get<Meditation[]>('/meditations'),
};
