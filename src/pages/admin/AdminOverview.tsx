import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { adminApi } from '@/lib/admin';
import { kindLabel, statusLabel } from '@/lib/format';
import type { AppointmentKind, SessionStatus } from '@/lib/types';
import { BarList, ColumnChart, Heatmap, Kpi, LineChart, RangePicker } from '@/components/charts';
import { bucketize, localTimeZone, pct, usePersistedRange } from '@/lib/chart-utils';
import { Card, ErrorState, Loading, PageHeader } from '@/components/ui';

const rangeText = (d: number) => (d === 365 ? 'last 12 months' : `last ${d} days`);

export function AdminOverviewPage() {
  const [days, setDays] = usePersistedRange('spool.admin.range', 30);
  const tz = localTimeZone();
  const q = useQuery({
    queryKey: ['admin', 'overview', days, tz],
    queryFn: () => adminApi.overview(days, tz),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const charts = useMemo(() => {
    if (!q.data) return null;
    const activity = bucketize(q.data.series, ['journalEntries', 'sessions', 'checkIns'], 92);
    const signups = bucketize(q.data.series, ['signups']);
    return { activity, signups };
  }, [q.data]);

  const header = (
    <div className="page-toolbar">
      <PageHeader title="Analytics" subtitle={`All Spool users · ${rangeText(days)} · times in ${tz}`} />
      <RangePicker value={days} onChange={setDays} />
    </div>
  );

  if (q.isPending) return (<>{header}<Loading /></>);
  if (q.isError) return (<>{header}<ErrorState error={q.error} onRetry={() => q.refetch()} /></>);
  const a = q.data;
  const t = a.totals;
  const p = a.period;
  const signedUp = a.funnel[0]?.users ?? 0;
  const statusTotal = a.sessions.byStatus.reduce((s, r) => s + r.count, 0);
  const durTotal = a.sessions.durations.reduce((s, r) => s + r.count, 0);
  const kindTotal = a.appointments.byKind.reduce((s, r) => s + r.count, 0);

  return (
    <>
      {header}
      {q.isFetching && !q.isPending && <div className="refresh-hint muted small">Updating…</div>}

      <section aria-label="Headline numbers" className="stats stats-5">
        <Kpi label="Total users" value={t.users.toLocaleString()} hint={`+${p.newUsers.value} in ${rangeText(days)}`} />
        <Kpi label="New sign-ups" value={p.newUsers.value.toLocaleString()} change={p.newUsers.change} hint="vs previous period" />
        <Kpi label="Active users" value={p.activeUsers.value.toLocaleString()} change={p.activeUsers.change} hint={`${pct(p.activeUsers.value, t.users)} of all users`} />
        <Kpi label="Journal entries" value={p.journalEntries.value.toLocaleString()} change={p.journalEntries.change} hint="vs previous period" />
        <Kpi label="Sessions recorded" value={p.sessions.value.toLocaleString()} change={p.sessions.change} hint={p.sessionFailureRate != null ? `${p.sessionFailureRate}% failed` : undefined} />
      </section>

      <div className="grid-3">
        <Card title="Engagement">
          <dl className="mini-stats">
            <div>
              <dt>Daily active</dt>
              <dd>{t.dau}</dd>
            </div>
            <div>
              <dt>Weekly active</dt>
              <dd>{t.wau}</dd>
            </div>
            <div>
              <dt>Monthly active</dt>
              <dd>{t.mau}</dd>
            </div>
            <div>
              <dt>Stickiness (DAU/MAU)</dt>
              <dd>{pct(t.dau, t.mau)}</dd>
            </div>
          </dl>
          <p className="muted small">Active = wrote, recorded or checked in during the last 1 / 7 / 30 days.</p>
        </Card>
        <Card title="All-time content">
          <dl className="mini-stats">
            <div>
              <dt>Journal entries</dt>
              <dd>{t.journalEntries.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Saved sessions</dt>
              <dd>{t.savedSessions.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Hours recorded</dt>
              <dd>{t.sessionHours.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Goal check-ins</dt>
              <dd>{t.checkIns.toLocaleString()}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Accounts">
          <dl className="mini-stats">
            <div>
              <dt>Journal-only mode</dt>
              <dd>
                {t.journalOnly} <span className="muted small">({pct(t.journalOnly, t.users)})</span>
              </dd>
            </div>
            <div>
              <dt>Graduated therapy</dt>
              <dd>
                {t.graduated} <span className="muted small">({pct(t.graduated, t.users)})</span>
              </dd>
            </div>
            <div>
              <dt>Added appointments</dt>
              <dd>
                {a.adoption.appointments} <span className="muted small">({pct(a.adoption.appointments, t.users)})</span>
              </dd>
            </div>
            <div>
              <dt>Upcoming appointments</dt>
              <dd>{a.appointments.upcoming}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <LineChart title="Daily active users" subtitle="Users who wrote, recorded or checked in each day" data={a.series} series={[{ key: 'activeUsers', label: 'Active users' }]} />
      </Card>

      <div className="grid-2">
        <Card>
          <LineChart
            title="Activity"
            subtitle={charts!.activity.unit === 'week' ? 'Weekly totals' : 'Daily totals'}
            data={charts!.activity.points}
            unit={charts!.activity.unit}
            series={[
              { key: 'journalEntries', label: 'Journal' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'checkIns', label: 'Check-ins' },
            ]}
          />
        </Card>
        <Card>
          <ColumnChart title="New sign-ups" subtitle={charts!.signups.unit === 'week' ? 'Per week' : 'Per day'} data={charts!.signups.points} valueKey="signups" valueLabel="Sign-ups" unit={charts!.signups.unit} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Activation funnel" action={<span className="muted small">All time</span>}>
          <BarList items={a.funnel.map((f) => ({ label: f.step, value: f.users }))} total={signedUp} empty="No users yet" />
          <p className="muted small">Share of everyone who signed up who reached each step at least once.</p>
        </Card>
        <Card title="Weekly retention" action={<span className="muted small">By sign-up week</span>}>
          {a.cohorts.length === 0 ? (
            <p className="muted">No sign-ups in the last 8 weeks.</p>
          ) : (
            <div className="table-scroll">
              <table className="table cohort">
                <thead>
                  <tr>
                    <th>Signed up</th>
                    <th className="num">Users</th>
                    {[1, 2, 3, 4].map((w) => (
                      <th key={w} className="num">
                        Week {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.cohorts.map((c) => (
                    <tr key={c.week}>
                      <td>{new Date(`${c.week}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</td>
                      <td className="num">{c.size}</td>
                      {c.retained.map((r, i) => {
                        const share = r == null || !c.size ? null : r / c.size;
                        return (
                          <td key={i} className="num cohort-cell" style={share != null ? ({ '--level': share === 0 ? 0 : 12 + share * 88 } as React.CSSProperties) : undefined}>
                            {share == null ? <span className="muted">—</span> : `${Math.round(share * 100)}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">Share of each week's new users who were active again 1–4 weeks after signing up. "—" means that week hasn't finished yet.</p>
        </Card>
      </div>

      <Card title="When people use Spool" action={<span className="muted small">{rangeText(days)} · {tz}</span>}>
        <Heatmap grid={a.heatmap} />
      </Card>

      <div className="grid-3">
        <Card title="Sessions by status" action={<span className="muted small">All time</span>}>
          <BarList items={a.sessions.byStatus.map((s) => ({ label: statusLabel[s.status as SessionStatus] ?? s.status, value: s.count }))} total={statusTotal} empty="No sessions yet" />
        </Card>
        <Card title="Session length" action={<span className="muted small">{a.sessions.avgMinutes != null ? `Avg ${a.sessions.avgMinutes} min` : ''}</span>}>
          <BarList items={a.sessions.durations.map((d) => ({ label: d.bucket, value: d.count }))} total={durTotal} empty="No saved sessions yet" />
        </Card>
        <Card title="Goals">
          <dl className="mini-stats">
            <div>
              <dt>Goals set</dt>
              <dd>{a.goals.total}</dd>
            </div>
            <div>
              <dt>Active now</dt>
              <dd>{a.goals.active}</dd>
            </div>
          </dl>
          <BarList
            items={a.goals.checkInRates.map((r) => ({ label: `${r.cadence === 'daily' ? 'Daily' : 'Weekly'} goals: marked done`, value: r.done, hint: `${pct(r.done, r.total)} of ${r.total} check-ins` }))}
            empty="No check-ins yet"
          />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Appointment types">
          <BarList items={a.appointments.byKind.map((k) => ({ label: kindLabel[k.kind as AppointmentKind] ?? k.kind, value: k.count }))} total={kindTotal} empty="No appointments yet" />
          <p className="muted small">
            {a.appointments.total} added · {a.appointments.cancelled} cancelled ({pct(a.appointments.cancelled, a.appointments.total)})
          </p>
        </Card>
        <Card title="Users" action={<Link to="/admin/users" className="small">See all users →</Link>}>
          <p>Browse every account with sign-up date, last activity and usage counts. Sort by the most active, or search by email.</p>
          <Link to="/admin/users" className="btn btn-secondary">
            Open user list
          </Link>
        </Card>
      </div>

      <p className="muted small">Updated {new Date(a.generatedAt).toLocaleTimeString()} · refreshes every minute.</p>
    </>
  );
}
