import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtDuration, relativeDay, statusLabel } from '@/lib/format';
import type { TherapySession } from '@/lib/types';
import { Badge, BulletList, Card, EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';

const hasSummary = (s: TherapySession) => s.mainPoints.length > 0 || s.takeaways.length > 0;

export function Sessions() {
  const saved = useQuery({ queryKey: ['sessions'], queryFn: api.sessions });
  const pending = useQuery({ queryKey: ['sessions', 'pending'], queryFn: api.pendingSessions });
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of saved.data ?? []) for (const t of s.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [saved.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (saved.data ?? []).filter((s) => {
      if (topic && !s.topics.includes(topic)) return false;
      if (!needle) return true;
      return [s.title ?? '', ...s.topics, ...s.mainPoints, ...s.takeaways].some((x) => x.toLowerCase().includes(needle));
    });
  }, [saved.data, q, topic]);

  const totalMinutes = Math.round((saved.data ?? []).reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60);

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle={saved.data ? `${saved.data.length} saved sessions · ${totalMinutes} minutes recorded` : 'Summaries of your therapy sessions'}
      />

      {pending.data && pending.data.length > 0 && (
        <Card title="Needs attention">
          <ul className="list">
            {pending.data.map((s) => (
              <li key={s.id}>
                <Link to={`/sessions/${s.id}`} className="list-row">
                  <div>
                    <div>{s.title || 'Untitled session'}</div>
                    <div className="muted small">{relativeDay(s.createdAt)}</div>
                  </div>
                  <Badge tone={s.status === 'failed' ? 'danger' : 'warning'}>{statusLabel[s.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          <p className="muted small">Review, retry or discard these in the Spool app.</p>
        </Card>
      )}

      <div className="toolbar">
        <input type="search" className="search" placeholder="Search titles, topics and notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sessions" />
      </div>
      {topics.length > 0 && (
        <div className="chips" role="group" aria-label="Filter by topic">
          <button className={`chip ${topic === null ? 'is-active' : ''}`} onClick={() => setTopic(null)}>
            All
          </button>
          {topics.map(([t, n]) => (
            <button key={t} className={`chip ${topic === t ? 'is-active' : ''}`} onClick={() => setTopic(topic === t ? null : t)} aria-pressed={topic === t}>
              {t} <span className="muted">{n}</span>
            </button>
          ))}
        </div>
      )}

      {saved.isPending ? (
        <Loading />
      ) : saved.isError ? (
        <ErrorState error={saved.error} onRetry={() => saved.refetch()} />
      ) : saved.data.length === 0 ? (
        <EmptyState title="No saved sessions yet">Record a session in the Spool app; once you save its summary it appears here.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No sessions match" />
      ) : (
        <div className="cards">
          {filtered.map((s) => (
            <Link key={s.id} to={`/sessions/${s.id}`} className="card card-link">
              <div className="muted small">
                {fmtDate(s.createdAt)} · {fmtDuration(s.durationSeconds)}
              </div>
              <h3>{s.title || 'Session'}</h3>
              {s.topics.length > 0 && (
                <div className="tags">
                  {s.topics.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
              {hasSummary(s) ? <p className="clamp-3">{s.mainPoints[0] ?? s.takeaways[0]}</p> : <p className="muted">Summary not kept; goals only.</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function SessionDetail() {
  const { id = '' } = useParams();
  const q = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api.session(id),
    // Keep polling while the summary is being generated.
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 3000 : false),
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;

  return (
    <>
      <PageHeader
        back={{ to: '/sessions', label: 'Sessions' }}
        title={s.title || 'Session'}
        subtitle={
          <>
            {fmtDateTime(s.createdAt)} · {fmtDuration(s.durationSeconds)} {s.status !== 'saved' && <Badge tone={s.status === 'failed' ? 'danger' : 'warning'}>{statusLabel[s.status]}</Badge>}
          </>
        }
      />

      {s.status === 'processing' && <Loading label="Summarizing this session…" />}
      {s.status === 'failed' && (
        <div className="banner banner-danger">
          {s.failureReason || 'The summary could not be created.'} {s.canRetry ? 'You can try again from the Spool app.' : ''}
        </div>
      )}
      {s.status === 'draft' && <div className="banner">This summary is a draft. Review and save it in the Spool app.</div>}

      {s.topics.length > 0 && (
        <div className="tags">
          {s.topics.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      )}

      <div className="grid-2">
        <Card title="Main points">
          <BulletList items={s.mainPoints} empty={s.status === 'saved' ? 'Summary not kept.' : 'None'} />
        </Card>
        <Card title="Takeaways">
          <BulletList items={s.takeaways} empty={s.status === 'saved' ? 'Summary not kept.' : 'None'} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Daily goal">{s.dailyGoal ? <p>{s.dailyGoal}</p> : <p className="muted">None</p>}</Card>
        <Card title="Weekly goal">{s.weeklyGoal ? <p>{s.weeklyGoal}</p> : <p className="muted">None</p>}</Card>
      </div>

      {s.prompts.length > 0 && (
        <Card title="Discussion prompts brought to this session">
          <BulletList items={s.prompts} />
        </Card>
      )}

      <p className="muted small">Audio is never stored, and the transcript was deleted once this summary was drafted.</p>
    </>
  );
}
