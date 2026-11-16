import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { adminApi } from '@/lib/admin';
import { fmtDate, relativeDay, statusLabel } from '@/lib/format';
import type { SessionStatus } from '@/lib/types';
import { BarList, Kpi, LineChart, RangePicker } from '@/components/charts';
import { localTimeZone, pct } from '@/lib/chart-utils';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';

const PAGE = 25;
type SortKey = 'createdAt' | 'lastActiveAt' | 'journalEntries' | 'savedSessions' | 'checkIns';
const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'createdAt', label: 'Joined' },
  { key: 'lastActiveAt', label: 'Last active' },
  { key: 'journalEntries', label: 'Journal', num: true },
  { key: 'savedSessions', label: 'Sessions', num: true },
  { key: 'checkIns', label: 'Check-ins', num: true },
];

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const sort = (params.get('sort') as SortKey) || 'createdAt';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(0, Number(params.get('page')) || 0);
  const search = params.get('q') ?? '';
  const [draft, setDraft] = useState(search);
  const [changing, setChanging] = useState<string | null>(null);

  // Debounce typing into the URL (which drives the query).
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== search) {
        const next = new URLSearchParams(params);
        if (draft) next.set('q', draft);
        else next.delete('q');
        next.delete('page');
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search, params, setParams]);

  const q = useQuery({
    queryKey: ['admin', 'users', search, sort, order, page],
    queryFn: () => adminApi.users({ search, sort, order, limit: PAGE, offset: page * PAGE }),
    placeholderData: keepPreviousData,
  });

  const toggleUser = async (id: string, email: string, enabled: boolean) => {
    const action = enabled ? 'disable' : 'enable';
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${email}?`)) return;
    setChanging(id);
    try {
      await adminApi.setUserEnabled(id, !enabled);
      await q.refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `User could not be ${action}d.`);
    } finally {
      setChanging(null);
    }
  };

  const setSort = (key: SortKey) => {
    const next = new URLSearchParams(params);
    next.set('sort', key);
    next.set('order', sort === key && order === 'desc' ? 'asc' : 'desc');
    next.delete('page');
    setParams(next);
  };
  const go = (p: number) => {
    const next = new URLSearchParams(params);
    if (p) next.set('page', String(p));
    else next.delete('page');
    setParams(next);
  };
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / PAGE)) : 1;

  return (
    <>
      <PageHeader title="Users" subtitle={q.data ? `${q.data.total.toLocaleString()} ${search ? 'matching' : 'total'}` : 'Every Spool account'} />
      <div className="toolbar">
        <input type="search" className="search" placeholder="Search by email or name…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Search users" />
      </div>
      <Card>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState title={search ? 'No users match' : 'No users yet'} />
        ) : (
          <div className="table-x">
            <table className="table users-table">
              <thead>
                <tr>
                  <th>User</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={c.num ? 'num' : undefined} aria-sort={sort === c.key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button className="th-sort" onClick={() => setSort(c.key)}>
                        {c.label}
                        <span aria-hidden="true">{sort === c.key ? (order === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                      </button>
                    </th>
                  ))}
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/admin/users/${u.id}`} className="user-cell">
                        <span className="row-title">{u.displayName || u.email.split('@')[0]}</span>
                        <span className="muted small">{u.email}</span>
                      </Link>
                    </td>
                    <td className="nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="nowrap">{u.lastActiveAt ? relativeDay(u.lastActiveAt) : <span className="muted">Never</span>}</td>
                    <td className="num">{u.journalEntries}</td>
                    <td className="num">{u.savedSessions}</td>
                    <td className="num">{u.checkIns}</td>
                    <td>
                      <div className="tags tags-tight">
                        {!u.enabled && <Badge tone="warning">Disabled</Badge>}
                        {!u.privacyReviewedAt && <Badge tone="warning">Not onboarded</Badge>}
                        {u.journalOnly && <Badge>Journal only</Badge>}
                        {u.graduatedAt && <Badge tone="success">Graduated</Badge>}
                      </div>
                    </td>
                    <td className="num">
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        disabled={changing === u.id}
                        onClick={() => void toggleUser(u.id, u.email, u.enabled)}
                      >
                        {changing === u.id ? 'Updating…' : u.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => go(page - 1)}>
            ← Previous
          </button>
          <span className="muted small">
            Page {page + 1} of {pages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page + 1 >= pages} onClick={() => go(page + 1)}>
            Next →
          </button>
        </nav>
      )}
    </>
  );
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams();
  const [days, setDays] = useState(90);
  const tz = localTimeZone();
  const q = useQuery({ queryKey: ['admin', 'user', id, days, tz], queryFn: () => adminApi.user(id, days, tz), placeholderData: keepPreviousData });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { user: u, series, sessions, goals, appointments } = q.data;
  const statusTotal = sessions.byStatus.reduce((s, r) => s + r.count, 0);
  const activeDays = series.filter((d) => d.journalEntries + d.sessions + d.checkIns > 0).length;

  return (
    <>
      <div className="page-toolbar">
        <PageHeader
          back={{ to: '/admin/users', label: 'Users' }}
          title={u.displayName || u.email}
          subtitle={
            <>
              {u.email} · joined {fmtDate(u.createdAt)} · last active {u.lastActiveAt ? relativeDay(u.lastActiveAt).toLowerCase() : 'never'}
            </>
          }
        />
        <RangePicker value={days} onChange={setDays} options={[30, 90, 365]} />
      </div>
      <div className="tags">
        {u.privacyReviewedAt ? <Badge tone="success">Onboarded {fmtDate(u.privacyReviewedAt)}</Badge> : <Badge tone="warning">Privacy review not completed</Badge>}
        {u.journalOnly && <Badge>Journal-only mode</Badge>}
        {u.graduatedAt && <Badge tone="success">Graduated {fmtDate(u.graduatedAt)}</Badge>}
      </div>

      <section className="stats stats-5">
        <Kpi label="Journal entries" value={u.journalEntries} />
        <Kpi label="Saved sessions" value={u.savedSessions} hint={`${sessions.minutes} min recorded`} />
        <Kpi label="Goal check-ins" value={u.checkIns} hint={`${pct(goals.checkInsDone, u.checkIns)} marked done`} />
        <Kpi label="Appointments" value={u.appointments} hint={`${appointments.upcoming} upcoming`} />
        <Kpi label="Active days" value={activeDays} hint={`of the last ${days}`} />
      </section>

      <Card>
        <LineChart
          title="Activity"
          subtitle="Daily actions"
          data={series}
          series={[
            { key: 'journalEntries', label: 'Journal' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'checkIns', label: 'Check-ins' },
          ]}
        />
      </Card>

      <div className="grid-2">
        <Card title="Sessions by status">
          <BarList items={sessions.byStatus.map((s) => ({ label: statusLabel[s.status as SessionStatus] ?? s.status, value: s.count }))} total={statusTotal} empty="No sessions" />
        </Card>
        <Card title="Goals & appointments">
          <dl className="mini-stats">
            <div>
              <dt>Goals set</dt>
              <dd>{goals.total}</dd>
            </div>
            <div>
              <dt>Active goals</dt>
              <dd>{goals.active}</dd>
            </div>
            <div>
              <dt>Past appointments</dt>
              <dd>{appointments.past}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd>{appointments.cancelled}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <p className="muted small">For privacy, admins see counts and dates only, never journal text, session summaries or goal wording.</p>
    </>
  );
}
