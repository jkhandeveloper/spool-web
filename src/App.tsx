import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/ui';
import { Account } from '@/pages/Account';
import { AppointmentDetail, Appointments } from '@/pages/Appointments';
import { GoalDetail, Goals } from '@/pages/Goals';
import { Journal, JournalDetail } from '@/pages/Journal';
import { Login } from '@/pages/Login';
import { MeditationDetail, Meditations } from '@/pages/Meditations';
import { Overview } from '@/pages/Overview';
import { SessionDetail, Sessions } from '@/pages/Sessions';

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') return <Loading label="Opening Spool…" />;
  if (status === 'signedOut') {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="sessions/:id" element={<SessionDetail />} />
        <Route path="journal" element={<Journal />} />
        <Route path="journal/:id" element={<JournalDetail />} />
        <Route path="goals" element={<Goals />} />
        <Route path="goals/:id" element={<GoalDetail />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="appointments/:id" element={<AppointmentDetail />} />
        <Route path="meditations" element={<Meditations />} />
        <Route path="meditations/:id" element={<MeditationDetail />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
