import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/server/auth/current-user';
import { users } from '@/server/db/collections';

export const dynamic = 'force-dynamic';

// Signed-out (or removed) users go to /sign-in.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const account = await users().findOne({ _id: new ObjectId(user.id) });
  return <AppShell user={{ name: account?.name ?? user.email, email: user.email, role: user.role }}>{children}</AppShell>;
}
