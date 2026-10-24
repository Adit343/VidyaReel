import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getAppContext } from '@/server/app-data';

export const dynamic = 'force-dynamic';

// Signed-out (or removed) users go to /sign-in.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  return (
    <AppShell
      user={{ name: ctx.name, email: ctx.user.email, role: ctx.user.role }}
      quota={{ used: ctx.quota.used, limit: ctx.quota.limit }}
      notices={ctx.notices}
    >
      {children}
    </AppShell>
  );
}
