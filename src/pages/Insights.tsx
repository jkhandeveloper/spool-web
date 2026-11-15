import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api';
import { BarList, Kpi, LineChart, RangePicker } from '@/components/charts';
import { bucketize, localTimeZone, pct, usePersistedRange } from '@/lib/chart-utils';
import { Badge, Card, ErrorState, Loading, PageHeader } from '@/components/ui';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const rangeText = (d: number) => (d === 365 ? 'the last 12 months' : `the last ${d} days`);

export function Insights() {
  const [days, setDays] = usePersistedRange('spool.insights.range', 30);
  const tz = localTimeZone();
  const q = useQuery({ queryKey: ['insights', days, tz], queryFn: () => api.insights(days, tz), placeholderData: keepPreviousData });
  const activity = useMemo(() => (q.data ? bucketize(q.data.series, ['journalEntries', 'sessions', 'checkIns'], 92) : null), [q.data]);

  const header = (
    <div className="page-toolbar">
      <PageHeader title="Insights" subtitle="Patterns in how you use Spool. Only you can see these." />
      <RangePicker value={days} onChange={setDays} />
    </div>
  );
  if (q.isPending) return (<>{header}<Loading /></>);
  if (q.isError) return (<>{header}<ErrorState error={q.error} onRetry={() => q.refetch()} /></>);
  const d = q.data;
  const t = d.totals;
  const bestDay = d.journalByWeekday.some((n) => n > 0) ? WEEKDAYS[d.journalByWeekday.indexOf(Math.max(...d.journalByWeekday))] : null;
  const bestPart = d.journalByTimeOfDay.reduce((a, b) => (b.count > a.count ? b : a), d.journalByTimeOfDay[0]);
  const topicTotal = d.topics.reduce((s, x) => s + x.count, 0);

  return (
    <>
      {header}

      <section className="stats stats-5">
        <Kpi label="Current streak" value={`${d.streak.current} ${d.streak.current === 1 ? 'day' : 'days'}`} hint={`Longest: ${d.streak.longest} ${d.streak.longest === 1 ? 'day' : 'days'}`} />
        <Kpi label="Active days" value={d.period.activeDays} hint={`in ${rangeText(days)}`} />
        <Kpi label="Journal entries" value={d.period.journalEntries.value} change={d.period.journalEntries.change} hint="vs previous period" />
        <Kpi label="Sessions" value={d.period.sessions.value} change={d.period.sessions.change} hint="vs previous period" />
        <Kpi label="Goal check-ins" value={d.period.checkIns.value} change={d.period.checkIns.change} hint="vs previous period" />
      </section>

      {(bestDay || d.streak.current > 1) && (
        <div className="highlights">
          {d.streak.current > 1 && (
            <div className="highlight">
              You've shown up {d.streak.current} days in a row. Keep the thread going.
            </div>
          )}
          {bestDay && bestPart.count > 0 && (
            <div className="highlight">
              You journal most on <strong>{bestDay}s</strong>, usually in the <strong>{bestPart.part.toLowerCase()}</strong>.
            </div>
          )}
        </div>
      )}

      <Card>
        <LineChart
          title="Your activity"
          subtitle={activity!.unit === 'week' ? 'Weekly totals' : 'Daily totals'}
          data={activity!.points}
          unit={activity!.unit}
          series={[
            { key: 'journalEntries', label: 'Journal' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'checkIns', label: 'Check-ins' },
          ]}
        />
      </Card>

      <div className="grid-2">
        <Card title="When you journal" action={<span className="muted small">All time</span>}>
          <BarList items={WEEKDAYS.map((w, i) => ({ label: w, value: d.journalByWeekday[i] }))} empty="Write your first entry to see this." />
          <div className="divider" />
          <BarList items={d.journalByTimeOfDay.map((p) => ({ label: p.part, value: p.count }))} empty="" />
        </Card>
        <Card title="What your sessions cover" action={<span className="muted small">Top topics</span>}>
          {d.topics.length === 0 ? (
            <p className="muted">Topics appear once you save session summaries.</p>
          ) : (
            <BarList items={d.topics.map((x) => ({ label: x.topic, value: x.count }))} total={topicTotal} />
          )}
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Journal">
          <dl className="mini-stats">
            <div>
              <dt>Entries</dt>
              <dd>{t.journalEntries.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Words written</dt>
              <dd>{t.words.toLocaleString()}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Sessions">
          <dl className="mini-stats">
            <div>
              <dt>Saved</dt>
              <dd>{t.savedSessions}</dd>
            </div>
            <div>
              <dt>Time recorded</dt>
              <dd>{t.sessionMinutes >= 120 ? `${Math.round(t.sessionMinutes / 6) / 10} h` : `${t.sessionMinutes} min`}</dd>
            </div>
            <div>
              <dt>Appointments kept</dt>
              <dd>{t.appointmentsPast}</dd>
            </div>
            <div>
              <dt>Upcoming</dt>
              <dd>{t.appointmentsUpcoming}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Goals">
          <dl className="mini-stats">
            <div>
              <dt>Goals set</dt>
              <dd>{t.goals}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{t.goalsCompleted}</dd>
            </div>
          </dl>
          {d.checkInRates.length === 0 ? (
            <p className="muted small">Check in on a goal to see how often you follow through.</p>
          ) : (
            d.checkInRates.map((r) => (
              <p key={r.cadence} className="small">
                <Badge tone={r.total && r.done / r.total >= 0.5 ? 'success' : 'neutral'}>{pct(r.done, r.total)}</Badge> of {r.cadence} goal check-ins marked done ({r.done}/{r.total})
              </p>
            ))
          )}
        </Card>
      </div>
      <p className="muted small">Days are counted in your time zone ({tz}).</p>
    </>
  );
}
