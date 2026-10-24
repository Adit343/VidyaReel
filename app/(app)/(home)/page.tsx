import { redirect } from 'next/navigation';
import { HomeClient } from '@/components/home/HomeClient';
import { getAppContext } from '@/server/app-data';
import { videos } from '@/server/db/collections';
import { formatCountdown } from '@/server/quota';
import { listVideos } from '@/server/videos/list';

export default async function Page() {
  // Layouts and pages render in parallel, so the page checks the session itself.
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const [recent, posted] = await Promise.all([
    listVideos(ctx.userId, 8),
    videos().countDocuments({ userId: ctx.userId, status: 'posted', deletedAt: { $exists: false } }),
  ]);
  return (
    <HomeClient
      quota={{
        used: ctx.quota.used, limit: ctx.quota.limit, resetsIn: formatCountdown(ctx.quota.resetsInMs),
        tzLabel: ctx.timeZone === 'Asia/Kolkata' ? 'IST' : ctx.timeZone,
      }}
      videos={recent} postedCount={posted} timeZone={ctx.timeZone}
    />
  );
}
