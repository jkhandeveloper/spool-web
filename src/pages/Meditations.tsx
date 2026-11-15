import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { fmtDuration } from '@/lib/format';
import { Card, ErrorState, Loading, PageHeader } from '@/components/ui';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Meditations() {
  const q = useQuery({ queryKey: ['meditations'], queryFn: api.meditations, staleTime: Infinity });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader title="Meditations" subtitle="Guided, text-and-timer meditations" />
      <div className="cards">
        {q.data.map((m) => (
          <Link key={m.id} to={`/meditations/${m.id}`} className="card card-link">
            <div className="muted small">{fmtDuration(m.durationSeconds)}</div>
            <h3>{m.title}</h3>
            <p className="muted">{m.subtitle}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export function MeditationDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['meditations', id], queryFn: api.meditations, select: (all) => all.find((m) => m.id === id) ?? null, staleTime: Infinity });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data;
  if (!m) return <ErrorState error={new Error('not found')} />;
  return (
    <>
      <PageHeader back={{ to: '/meditations', label: 'Meditations' }} title={m.title} subtitle={`${m.subtitle} · ${fmtDuration(m.durationSeconds)}`} />
      <Card title="Script">
        <ol className="timeline">
          {m.steps.map((s) => (
            <li key={s.at}>
              <span className="muted small mono">{mmss(s.at)}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </Card>
      <p className="muted small">Play this meditation with its timer in the Spool app.</p>
    </>
  );
}
