import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Goal } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, Stat } from '@/components/ui';

function GoalRow({ g }: { g: Goal }) {
  return (
    <li>
      <Link to={`/goals/${g.id}`} className="list-row">
        <div>
          <div className="eyebrow">{g.cadence === 'daily' ? 'Daily' : 'Weekly'} · set {fmtDate(g.createdAt)}</div>
          <div>{g.text}</div>
        </div>
        {g.completedAt ? (
          <Badge tone="success">Completed</Badge>
        ) : g.active ? (
          g.doneThisPeriod ? <Badge tone="success">✓ Done this {g.cadence === 'daily' ? 'day' : 'week'}</Badge> : <Badge>Active</Badge>
        ) : (
          <Badge>Retired</Badge>
        )}
      </Link>
    </li>
  );
}

export function Goals() {
  const active = useQuery({ queryKey: ['goals'], queryFn: () => api.goals(false) });
  const all = useQuery({ queryKey: ['goals', 'all'], queryFn: () => api.goals(true) });
  const past = (all.data ?? []).filter((g) => !g.active);

  return (
    <>
      <PageHeader title="Goals" subtitle="Daily and weekly goals from your session summaries" />
      <Card title="Active">
        {active.isPending ? (
          <Loading />
        ) : active.isError ? (
          <ErrorState error={active.error} onRetry={() => active.refetch()} />
        ) : active.data.length === 0 ? (
          <EmptyState title="No active goals">Saving a session summary sets new daily and weekly goals.</EmptyState>
        ) : (
          <ul className="list">
            {active.data.map((g) => (
              <GoalRow key={g.id} g={g} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Past goals">
        {all.isPending ? (
          <Loading />
        ) : all.isError ? (
          <ErrorState error={all.error} onRetry={() => all.refetch()} />
        ) : past.length === 0 ? (
          <EmptyState title="No past goals yet" />
        ) : (
          <ul className="list">
            {past.map((g) => (
              <GoalRow key={g.id} g={g} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function GoalDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['goals', id], queryFn: () => api.goal(id) });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const g = q.data;
  const checkIns = g.checkIns ?? [];
  const done = checkIns.filter((c) => c.completed).length;

  return (
    <>
      <PageHeader
        back={{ to: '/goals', label: 'Goals' }}
        title={g.text}
        subtitle={`${g.cadence === 'daily' ? 'Daily' : 'Weekly'} goal · set ${fmtDate(g.createdAt)}${g.completedAt ? ` · completed ${fmtDate(g.completedAt)}` : ''}`}
      />
      <div className="stats">
        <Stat label="Status" value={g.completedAt ? 'Completed' : g.active ? 'Active' : 'Retired'} hint={g.active && g.doneThisPeriod ? `Done this ${g.cadence === 'daily' ? 'day' : 'week'}` : undefined} />
        <Stat label="Check-ins" value={checkIns.length} />
        <Stat label="Marked done" value={checkIns.length ? `${Math.round((done / checkIns.length) * 100)}%` : '—'} hint={`${done} of ${checkIns.length}`} />
      </div>
      {g.sessionId && (
        <p>
          <Link to={`/sessions/${g.sessionId}`}>View the session this goal came from →</Link>
        </p>
      )}
      <Card title="Check-ins">
        {checkIns.length === 0 ? (
          <EmptyState title="No check-ins yet">Check in on this goal from the Spool app.</EmptyState>
        ) : (
          <ul className="list">
            {checkIns.map((c) => (
              <li key={c.id} className="list-row static">
                <div>
                  <div className="muted small">{fmtDateTime(c.createdAt)}</div>
                  {c.reflection ? <p className="prose">{c.reflection}</p> : <p className="muted">No reflection</p>}
                </div>
                {c.completed ? <Badge tone="success">✓ Done</Badge> : <Badge>Not done</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
