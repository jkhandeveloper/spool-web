import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '@/lib/auth';
import { Logo } from './ui';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/insights', label: 'Insights' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/journal', label: 'Journal' },
  { to: '/goals', label: 'Goals' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/meditations', label: 'Meditations' },
  { to: '/account', label: 'Account' },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <Logo />
          <span>Spool</span>
          <button className="btn btn-link menu-toggle" aria-expanded={open} aria-controls="nav" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="nav" className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small">{user?.displayName || 'Signed in'}</div>
          <div className="muted small truncate">{user?.email}</div>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
