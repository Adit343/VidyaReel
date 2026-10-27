import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dateTimeLabel, untilLabel } from '@/lib/time';
import { getAppContext } from '@/server/app-data';
import { listPosts, type PostListItem } from '@/server/posts/service';

export const dynamic = 'force-dynamic';

const CARD = 'bg-white rounded-2xl border border-[#D3DBD0] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4';

const CHIP: Record<PostListItem['status'], { text: string; cls: string }> = {
  scheduled: { text: 'Scheduled', cls: 'bg-[#FFF9EE] border-[#F5DCB7] text-[#B36B00]' },
  publishing: { text: 'Posting now', cls: 'bg-[#E7F6ED] border-[#1A8F5A]/30 text-[#1A8F5A]' },
  posted: { text: 'Posted', cls: 'bg-[#E7FFF2] border-[#A7E8C5] text-[#1A8F5A]' },
  failed: { text: 'Failed', cls: 'bg-[#FDF3F2] border-[#F4C8C5] text-[#C93A2E]' },
  cancelled: { text: 'Cancelled', cls: 'bg-[#EEF1EC] border-[#D3DBD0] text-[#506359]' },
};

function Row({ p, tz }: { p: PostListItem; tz: string }) {
  const chip = p.paused ? { text: 'Paused', cls: CHIP.failed.cls } : CHIP[p.status];
  const when = p.status === 'scheduled' && p.scheduledAt
    ? `${dateTimeLabel(p.scheduledAt, tz)} (${untilLabel(p.scheduledAt)})`
    : p.status === 'posted' ? `Posted ${dateTimeLabel(p.updatedAt, tz)}` : dateTimeLabel(p.updatedAt, tz);
  return (
    <li className={CARD}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-headline-sm text-base text-[#0F2A20] font-bold truncate">{p.title}</h3>
          <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-[11px] font-code-sm font-medium ${chip.cls}`}>{chip.text}</span>
        </div>
        <p className="text-xs font-code-sm text-[#54675D] mt-1">{when}</p>
        {p.status === 'failed' && p.error && <p className="text-xs text-[#C93A2E] mt-1">{p.error.message}</p>}
        {p.paused && <p className="text-xs text-[#B36B00] mt-1">Waiting for you to reconnect Instagram.</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {p.permalink && (
          <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border border-[#D3DBD0] bg-white hover:bg-[#E1E7DF] text-xs font-ui-medium font-semibold text-[#0F2A20]">View on Instagram</a>
        )}
        <Link href={`/videos/${p.videoId}/post`} className="px-4 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold">
          {p.status === 'scheduled' || p.status === 'failed' ? 'Manage' : 'Open'}
        </Link>
      </div>
    </li>
  );
}

export default async function Page() {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const items = await listPosts(ctx.userId);
  const groups: [string, PostListItem[]][] = [
    ['Upcoming', items.filter((p) => p.status === 'scheduled' || p.status === 'publishing').reverse()],
    ['Published', items.filter((p) => p.status === 'posted')],
    ['Failed or cancelled', items.filter((p) => p.status === 'failed' || p.status === 'cancelled')],
  ];
  return (
    <main className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-10 py-10">
      <div className="max-w-[820px] mx-auto flex flex-col gap-8">
        <header>
          <h1 className="font-headline-lg text-4xl text-[#0F2A20] tracking-tight font-bold">Posts</h1>
          <p className="text-[15px] text-[#506359] mt-1.5">Your scheduled and published Instagram reels. Times are in {ctx.timeZone}.</p>
        </header>
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#B9C5B5] bg-white p-10 text-center">
            <p className="font-headline-md text-xl text-[#0F2A20] font-bold">No posts yet</p>
            <p className="text-sm text-[#54675D] mt-1">When you post or schedule a video it shows up here.</p>
            <Link href="/library" className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-sm font-ui-medium font-semibold">Open your library</Link>
          </div>
        ) : groups.filter(([, rows]) => rows.length).map(([name, rows]) => (
          <section key={name} aria-label={name} className="flex flex-col gap-3">
            <h2 className="text-xs font-code-sm uppercase tracking-wider text-[#54675D]">{name} ({rows.length})</h2>
            <ul className="flex flex-col gap-3">{rows.map((p) => <Row key={p.id} p={p} tz={ctx.timeZone} />)}</ul>
          </section>
        ))}
      </div>
    </main>
  );
}
