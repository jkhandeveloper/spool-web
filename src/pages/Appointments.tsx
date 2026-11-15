import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '@/lib/api';
import { fmtDateTime, kindLabel, relativeDay } from '@/lib/format';
import type { Appointment } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';

const DAY = 86_400_000;
const RANGE_DAYS = 180; // API allows up to 400 days per request

function useRange(direction: 'upcoming' | 'past') {
  // Fix "now" for the lifetime of the page so the query key is stable.
  const [now] = useState(() => Date.now());
  return useMemo(
    () =>
      direction === 'upcoming'
        ? { now, from: new Date(now - DAY), to: new Date(now + RANGE_DAYS * DAY) }
        : { now, from: new Date(now - RANGE_DAYS * DAY), to: new Date(now) },
    [direction, now],
  );
}

function ApptRow({ a }: { a: Appointment }) {
  return (
    <li>
      <Link to={`/appointments/${a.id}`} className="list-row">
        <div>
          <div className="row-title">{a.title}</div>
          <div className="muted small">
            {fmtDateTime(a.startsAt)} · {a.durationMinutes} min{a.location ? ` · ${a.location}` : ''}
          </div>
        </div>
        <div className="row-meta">
          <Badge>{kindLabel[a.kind]}</Badge>
          <span className="muted small nowrap">{relativeDay(a.startsAt)}</span>
        </div>
      </Link>
    </li>
  );
}

export function Appointments() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { now, from, to } = useRange(tab);
  const q = useQuery({
    queryKey: ['appointments', tab, from.toISOString()],
    queryFn: () => api.appointments(from, to),
  });

  const items = useMemo(() => {
    const list = q.data ?? [];
    return tab === 'upcoming'
      ? list.filter((a) => new Date(a.startsAt).getTime() + a.durationMinutes * 60_000 > now)
      : [...list].reverse();
  }, [q.data, tab, now]);

  return (
    <>
      <PageHeader title="Appointments" subtitle={`Therapy appointments, ${RANGE_DAYS} days ${tab === 'upcoming' ? 'ahead' : 'back'}`} />
      <div className="tabs" role="tablist">
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>
      <Card>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={tab === 'upcoming' ? 'Nothing scheduled' : 'No past appointments'}>Add appointments in the Spool app.</EmptyState>
        ) : (
          <ul className="list">
            {items.map((a) => (
              <ApptRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function AppointmentDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['appointments', 'detail', id], queryFn: () => api.appointment(id) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const a = q.data;
  return (
    <>
      <PageHeader back={{ to: '/appointments', label: 'Appointments' }} title={a.title} subtitle={fmtDateTime(a.startsAt)} />
      {a.cancelledAt && <div className="banner banner-danger">This appointment was cancelled.</div>}
      <Card>
        <dl className="dl">
          <dt>When</dt>
          <dd>
            {fmtDateTime(a.startsAt)} ({relativeDay(a.startsAt)})
          </dd>
          <dt>Length</dt>
          <dd>{a.durationMinutes} minutes</dd>
          <dt>Type</dt>
          <dd>{kindLabel[a.kind]}</dd>
          <dt>Location</dt>
          <dd>{a.location || <span className="muted">—</span>}</dd>
          <dt>Reminder</dt>
          <dd>{a.reminderMinutesBefore == null ? 'Off' : `${a.reminderMinutesBefore} minutes before`}</dd>
        </dl>
      </Card>
      <Card title="Notes">{a.notes ? <div className="prose">{a.notes}</div> : <p className="muted">No notes</p>}</Card>
    </>
  );
}
