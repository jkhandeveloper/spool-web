// The refresh token lives in sessionStorage (cleared when the tab closes) unless
// the user ticks "Keep me signed in", in which case it goes to localStorage.
// The access token is never persisted; it lives in memory in api.ts.
const KEY = 'spool.refreshToken';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const tokenStore = {
  get(): string | null {
    return safe(() => sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY), null);
  },
  set(token: string, remember?: boolean) {
    // Keep whichever store the token is already in unless told otherwise.
    const persist = remember ?? safe(() => localStorage.getItem(KEY) !== null, false);
    this.clear();
    safe(() => (persist ? localStorage : sessionStorage).setItem(KEY, token), undefined);
  },
  clear() {
    safe(() => sessionStorage.removeItem(KEY), undefined);
    safe(() => localStorage.removeItem(KEY), undefined);
  },
};
