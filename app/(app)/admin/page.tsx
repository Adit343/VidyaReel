import { AdminPanel, type Member } from '@/components/admin/AdminPanel';
import { getUsage } from '@/server/admin/usage';
import { listApproved } from '@/server/admin/approved-emails';
import { getAppContext } from '@/server/app-data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [ctx, members, usage] = await Promise.all([getAppContext(), listApproved({ includeRemoved: true }), getUsage()]);
  // Dates cross the server/client boundary as strings, the same shape the API returns.
  return (
    <AdminPanel
      initialMembers={JSON.parse(JSON.stringify(members)) as Member[]}
      initialUsage={usage}
      selfEmail={ctx?.user.email ?? ''}
    />
  );
}
