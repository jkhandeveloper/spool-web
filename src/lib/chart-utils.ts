import { useState } from 'react';

export interface Point {
  day: string; // YYYY-MM-DD (bucket start)
  [key: string]: number | string;
}

/** Sum daily points into weekly buckets when the range is long. */
export function bucketize<T extends Point>(points: T[], keys: string[], maxBars = 60): { points: Point[]; unit: 'day' | 'week' } {
  if (points.length <= maxBars) return { points, unit: 'day' };
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    const p: Point = { day: chunk[0].day };
    for (const k of keys) p[k] = chunk.reduce((s, c) => s + Number(c[k] ?? 0), 0);
    out.push(p);
  }
  return { points: out, unit: 'week' };
}

export function usePersistedRange(key: string, fallback = 30) {
  const [days, setDays] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(key));
      return [7, 30, 90, 365].includes(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (d: number) => {
    setDays(d);
    try {
      localStorage.setItem(key, String(d));
    } catch {
      /* storage unavailable */
    }
  };
  return [days, set] as const;
}

export const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

