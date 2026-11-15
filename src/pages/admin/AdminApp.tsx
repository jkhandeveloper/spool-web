import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { ApiError } from '@/lib/api';
import { adminApi, adminSignOut, useAdminToken } from '@/lib/admin';
import { Logo } from '@/components/ui';
import { AdminOverviewPage } from './AdminOverview';
import { AdminUserDetailPage, AdminUsersPage } from './AdminUsers';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await adminApi.login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <Logo size={44} />
          <h1>Spool Admin</h1>
          <p className="muted">App-wide analytics. Sign in with the admin username and password from the API's .env file.</p>
        </div>
        <label className="field">
          <span>Username</span>
          <input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small center">
          <a href="/">Back to the Spool dashboard</a>
        </p>
      </form>
    </div>
  );
}

function AdminShell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const signOut = () => {
    adminSignOut();
    qc.removeQueries({ queryKey: ['admin'] });
  };
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <Logo />
          <span>Spool</span>
          <span className="badge badge-admin">Admin</span>
          <button className="btn btn-link menu-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav className="nav">
          <NavLink to="/admin" end className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
            Analytics
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
            Users
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="small">Administrator</div>
          <div className="muted small">Counts and activity only; no journal or session content.</div>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main main-wide">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminApp() {
  const token = useAdminToken();
  if (!token) return <AdminLogin />;
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
