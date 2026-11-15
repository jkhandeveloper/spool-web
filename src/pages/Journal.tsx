import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';

const PAGE = 20;

export function Journal() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, parseInt(params.get('page') ?? '0', 10) || 0);
  const q = useQuery({
    queryKey: ['journal', page],
    queryFn: () => api.journal(PAGE, page * PAGE),
    placeholderData: keepPreviousData,
  });

  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / PAGE)) : 1;
  const go = (p: number) => setParams(p ? { page: String(p) } : {});

  return (
    <>
      <PageHeader title="Journal" subtitle={q.data ? `${q.data.total} entries` : 'Your thought journal'} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.total === 0 ? (
        <EmptyState title="No journal entries yet">Write in the Spool app and your entries show up here.</EmptyState>
      ) : (
        <>
          <Card>
            <ul className="list">
              {q.data.items.map((e) => (
                <li key={e.id}>
                  <Link to={`/journal/${e.id}`} className="list-row">
                    <div className="min-w-0">
                      <div className="row-title">{e.title}</div>
                      <div className="muted clamp-1">{e.body}</div>
                    </div>
                    <div className="row-meta">
                      <span className="muted small nowrap">{fmtDate(e.createdAt)}</span>
                      {!e.includeInPrompts && <Badge>Private</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => go(page - 1)}>
                ← Newer
              </button>
              <span className="muted small">
                Page {page + 1} of {pages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page + 1 >= pages} onClick={() => go(page + 1)}>
                Older →
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

export function JournalDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['journal', 'entry', id], queryFn: () => api.journalEntry(id) });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  return (
    <>
      <PageHeader back={{ to: '/journal', label: 'Journal' }} title={e.title} subtitle={fmtDateTime(e.createdAt)} />
      <Card>
        <div className="prose">{e.body}</div>
      </Card>
      <p className="muted small">
        {e.includeInPrompts ? 'This note can be suggested as a discussion prompt in your next session.' : 'This note is kept out of session prompts.'}
        {e.updatedAt !== e.createdAt && ` Edited ${fmtDateTime(e.updatedAt)}.`}
      </p>
    </>
  );
}
