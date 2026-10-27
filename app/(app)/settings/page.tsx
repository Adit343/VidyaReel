import { redirect } from 'next/navigation';
import { SettingsClient } from '@/components/settings/SettingsClient';
import { getAppContext } from '@/server/app-data';
import { posts } from '@/server/db/collections';
import { getConnection } from '@/server/instagram/connection';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ig?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const [{ connection }, scheduled] = await Promise.all([
    getConnection(ctx.userId), posts().countDocuments({ userId: ctx.userId, status: 'scheduled' }),
  ]);
  return <SettingsClient name={ctx.name} email={ctx.user.email} timeZone={ctx.timeZone} connection={connection} scheduledCount={scheduled} flag={(await searchParams).ig ?? null} />;
}
