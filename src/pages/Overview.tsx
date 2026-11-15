import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, greeting, kindLabel, relativeDay, statusLabel } from '@/lib/format';
import { ActivityChart } from '@/components/ActivityChart';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, Stat } from '@/components/ui';

export function Overview() {
  const { user } = useAuth();
  const today = useQuery({ queryKey: ['today'], queryFn: api.today });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: api.sessions });
  // 100 is the API's page cap; enough for a 12-week activity chart.
  const journal = useQuery({ queryKey: ['journal', 'recent'], queryFn: () => api.journal(100, 0) });

  if (today.isPending) return <Loading />;
  if (today.isError) return <ErrorState error={today.error} onRetry={() => today.refetch()} />;
  const t = today.data;
  const lastSession = sessions.data?.[0];

  return (
    <>
      <PageHeader title={greeting(user?.displayName)} subtitle={<em>“{t.reminder}”</em>} />

      {t.pendingSession && (
        <div className="banner">
          <Badge tone={t.pendingSession.status === 'failed' ? 'danger' : 'warning'}>{statusLabel[t.pendingSession.status]}</Badge>
          <span>
            A session from {relativeDay(t.pendingSession.createdAt).toLowerCase()} needs attention. Open Spool on your phone to{' '}
            {t.pendingSession.status === 'failed' ? 'retry or discard it' : 'review and save it'}.
          </span>
        </div>
      )}

      <div className="stats">
        <Stat label="Journal this week" value={t.journalThisWeek} hint={journal.data ? `${journal.data.total} entries total` : undefined} to="/journal" />
        <Stat
          label="Saved sessions"
          value={sessions.data?.length ?? '—'}
          hint={lastSession ? `Last: ${fmtDate(lastSession.createdAt)}` : 'None yet'}
          to="/sessions"
        />
        <Stat
          label="Goals done this period"
          value={t.goals.length ? `${t.goals.filter((g) => g.doneThisPeriod).length} / ${t.goals.length}` : '—'}
          hint={t.goals.length ? 'Active daily & weekly goals' : 'No active goals'}
          to="/goals"
        />
        <Stat
          label="Next appointment"
          value={t.nextAppointment ? relativeDay(t.nextAppointment.startsAt) : '—'}
          hint={t.nextAppointment ? fmtTime(t.nextAppointment.startsAt) : 'Nothing scheduled'}
          to="/appointments"
        />
      </div>

      <div className="grid-2">
        <Card title="Active goals" action={<Link to="/goals" className="small">All goals →</Link>}>
          {t.goals.length === 0 ? (
            <EmptyState title="No active goals">Goals appear here after you save a session summary.</EmptyState>
          ) : (
            <ul className="list">
              {t.goals.map((g) => (
                <li key={g.id}>
                  <Link to={`/goals/${g.id}`} className="list-row">
                    <div>
                      <div className="eyebrow">{g.cadence === 'daily' ? 'Daily goal' : 'Weekly goal'}</div>
                      <div>{g.text}</div>
                    </div>
                    {g.doneThisPeriod ? <Badge tone="success">✓ Done</Badge> : <Badge>Not yet</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Next appointment" action={<Link to="/appointments" className="small">Schedule →</Link>}>
          {t.nextAppointment ? (
            <div className="stack-sm">
              <div className="big">{t.nextAppointment.title}</div>
              <div>{fmtDateTime(t.nextAppointment.startsAt)}</div>
              <div className="muted">
                {kindLabel[t.nextAppointment.kind]} · {t.nextAppointment.durationMinutes} min
                {t.nextAppointment.location ? ` · ${t.nextAppointment.location}` : ''}
              </div>
            </div>
          ) : (
            <EmptyState title="Nothing scheduled" />
          )}
          <div className="divider" />
          <div className="eyebrow">{t.meditation.label}</div>
          <Link to={`/meditations/${t.meditation.id}`}>
            {t.meditation.title} · {fmtDuration(t.meditation.durationSeconds)}
          </Link>
        </Card>
      </div>

      <Card>
        {journal.isPending ? (
          <Loading />
        ) : journal.isError ? (
          <ErrorState error={journal.error} onRetry={() => journal.refetch()} />
        ) : (
          <ActivityChart label="Journal entries per week" unit={['entry', 'entries']} dates={journal.data.items.map((e) => e.createdAt)} />
        )}
      </Card>

      <Card title="Latest session" action={<Link to="/sessions" className="small">All sessions →</Link>}>
        {sessions.isPending ? (
          <Loading />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : !lastSession ? (
          <EmptyState title="No saved sessions yet">Record a session in the Spool app to see its summary here.</EmptyState>
        ) : (
          <Link to={`/sessions/${lastSession.id}`} className="list-row">
            <div>
              <div className="big">{lastSession.title || 'Session'}</div>
              <div className="muted small">
                {fmtDate(lastSession.createdAt)} · {fmtDuration(lastSession.durationSeconds)}
              </div>
              {lastSession.mainPoints[0] && <p className="clamp-2">{lastSession.mainPoints[0]}</p>}
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </Card>
    </>
  );
}
