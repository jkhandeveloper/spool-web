import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Card, PageHeader } from '@/components/ui';

export function Account() {
  const { user, signOut, signOutEverywhere } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function download() {
    setExporting(true);
    setError(null);
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `spool-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function everywhere() {
    if (!window.confirm('Sign out of Spool on every device, including your phone?')) return;
    await signOutEverywhere();
  }

  return (
    <>
      <PageHeader title="Account" />
      <Card title="Profile">
        <dl className="dl">
          <dt>Name</dt>
          <dd>{user.displayName || <span className="muted">Not set</span>}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Member since</dt>
          <dd>{fmtDate(user.createdAt)}</dd>
          <dt>Mode</dt>
          <dd>{user.journalOnly ? 'Journal only (no session recording)' : 'Journal and sessions'}</dd>
          <dt>Therapy</dt>
          <dd>{user.graduatedAt ? `Graduated ${fmtDate(user.graduatedAt)}` : 'In therapy'}</dd>
          <dt>Daily reminder</dt>
          <dd>{user.remindersEnabled ? `On, at ${user.reminderTime ?? '—'}` : 'Off'}</dd>
          <dt>Privacy review</dt>
          <dd>{user.privacyReviewedAt ? `Completed ${fmtDate(user.privacyReviewedAt)}` : 'Not completed'}</dd>
        </dl>
        <p className="muted small">Change these settings in the Spool app.</p>
      </Card>

      <Card title="Your data">
        <p>Download everything Spool stores about you (journal, session summaries, goals and appointments) as a JSON file.</p>
        {error && <p className="inline-error">{error}</p>}
        <button className="btn btn-secondary" onClick={download} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </button>
      </Card>

      <Card title="Sign out">
        <div className="row-actions">
          <button className="btn btn-secondary" onClick={signOut}>
            Sign out of this browser
          </button>
          <button className="btn btn-danger" onClick={everywhere}>
            Sign out everywhere
          </button>
        </div>
      </Card>
    </>
  );
}
