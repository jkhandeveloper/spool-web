export interface Change {
  value: number;
  /** % change vs the previous period; null = no baseline. */
  change: number | null;
}

export interface DayPoint {
  day: string;
  [key: string]: number | string;
}

export interface AdminOverview {
  generatedAt: string;
  days: number;
  tz: string;
  totals: {
    users: number;
    journalOnly: number;
    graduated: number;
    journalEntries: number;
    savedSessions: number;
    sessionHours: number;
    checkIns: number;
    dau: number;
    wau: number;
    mau: number;
  };
  period: {
    newUsers: Change;
    activeUsers: Change;
    journalEntries: Change;
    sessions: Change;
    checkIns: Change;
    sessionFailureRate: number | null;
  };
  series: (DayPoint & { signups: number; activeUsers: number; journalEntries: number; sessions: number; checkIns: number })[];
  funnel: { step: string; users: number }[];
  adoption: { appointments: number };
  sessions: { byStatus: { status: string; count: number }[]; durations: { bucket: string; count: number }[]; avgMinutes: number | null };
  goals: { total: number; active: number; completed: number; checkInRates: { cadence: string; total: number; done: number }[] };
  appointments: { total: number; cancelled: number; upcoming: number; byKind: { kind: string; count: number }[] };
  heatmap: number[][];
  cohorts: { week: string; size: number; retained: (number | null)[] }[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  journalOnly: boolean;
  enabled: boolean;
  graduatedAt: string | null;
  privacyReviewedAt: string | null;
  journalEntries: number;
  savedSessions: number;
  checkIns: number;
  appointments: number;
  lastActiveAt: string | null;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  days: number;
  series: (DayPoint & { journalEntries: number; sessions: number; checkIns: number })[];
  sessions: { byStatus: { status: string; count: number }[]; minutes: number };
  goals: { total: number; active: number; completed: number; checkInsDone: number };
  appointments: { past: number; upcoming: number; cancelled: number };
}

export interface Insights {
  days: number;
  tz: string;
  series: (DayPoint & { journalEntries: number; sessions: number; checkIns: number })[];
  totals: {
    journalEntries: number;
    words: number;
    savedSessions: number;
    sessionMinutes: number;
    goals: number;
    goalsCompleted: number;
    appointmentsPast: number;
    appointmentsUpcoming: number;
  };
  period: { journalEntries: Change; sessions: Change; checkIns: Change; activeDays: number };
  streak: { current: number; longest: number };
  journalByWeekday: number[];
  journalByTimeOfDay: { part: string; count: number }[];
  topics: { topic: string; count: number }[];
  checkInRates: { cadence: string; total: number; done: number }[];
}
