import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dateTimeLabel, untilLabel } from '@/lib/time';
import { getAppContext } from '@/server/app-data';
import { getConnection } from '@/server/instagram/connection';
import { listPosts, type PostListItem } from '@/server/posts/service';
import { storage } from '@/server/storage';

export const dynamic = 'force-dynamic';

const CHIP: Record<PostListItem['status'], { text: string; cls: string; dot: string }> = {
  scheduled: { text: 'Scheduled', cls: 'bg-[#FFF9EE] border-[#F5DCB7] text-[#B36B00]', dot: 'bg-[#FF9F1C]' },
  publishing: { text: 'Posting now', cls: 'bg-[#E7F6ED] border-[#1A8F5A]/30 text-[#1A8F5A]', dot: 'bg-[#1A8F5A] animate-pulse' },
  posted: { text: 'Posted', cls: 'bg-[#E7FFF2] border-[#A7E8C5] text-[#1A8F5A]', dot: 'bg-[#1A8F5A]' },
  failed: { text: 'Failed', cls: 'bg-[#FDF3F2] border-[#F4C8C5] text-[#C93A2E]', dot: 'bg-[#C93A2E]' },
  cancelled: { text: 'Cancelled', cls: 'bg-[#EEF1EC] border-[#D3DBD0] text-[#506359]', dot: 'bg-[#506359]' },
};

const FILTERS = [
  ['all', 'All'], ['upcoming', 'Upcoming'], ['published', 'Published'], ['attention', 'Failed or cancelled'],
] as const;
type Filter = (typeof FILTERS)[number][0];
const isUpcoming = (p: PostListItem) => p.status === 'scheduled' || p.status === 'publishing';
const matches = (p: PostListItem, f: Filter) =>
  f === 'all' || (f === 'upcoming' && isUpcoming(p)) || (f === 'published' && p.status === 'posted') || (f === 'attention' && (p.status === 'failed' || p.status === 'cancelled'));

function Tile({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D3DBD0] p-4 flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}><span className="material-symbols-outlined text-[22px]">{icon}</span></div>
      <div>
        <div className="font-display text-3xl text-[#0F2A20] font-bold tabular-nums leading-none">{value}</div>
        <div className="text-xs font-code-sm text-[#54675D] mt-1">{label}</div>
      </div>
    </div>
  );
}

function Row({ p, tz, username }: { p: PostListItem; tz: string; username: string | null }) {
  const chip = p.paused ? { text: 'Paused', cls: CHIP.failed.cls, dot: CHIP.failed.dot } : CHIP[p.status];
  const when = p.status === 'scheduled' && p.scheduledAt
    ? `${dateTimeLabel(p.scheduledAt, tz)} · ${untilLabel(p.scheduledAt)}`
    : p.status === 'publishing' ? 'Sending to Instagram now'
      : `${p.status === 'posted' ? 'Posted' : p.status === 'failed' ? 'Failed' : 'Cancelled'} ${dateTimeLabel(p.updatedAt, tz)}`;
  return (
    <li className="bg-white rounded-2xl border border-[#D3DBD0] p-3.5 sm:p-4 flex gap-4 items-stretch hover:border-[#B9C5B5] transition-colors">
      <div
        className="w-[68px] sm:w-[76px] shrink-0 aspect-[9/16] rounded-xl bg-gradient-to-b from-[#145A41] to-[#0F2A20] border border-[#D3DBD0] overflow-hidden flex items-center justify-center text-white/80"
        style={p.thumbUrl ? { backgroundImage: `url(${p.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        aria-hidden
      >
        {!p.thumbUrl && <span className="material-symbols-outlined text-[26px]">movie</span>}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-headline-sm text-base sm:text-lg text-[#0F2A20] font-bold truncate max-w-full">{p.title}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-code-sm font-medium ${chip.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />{chip.text}
            </span>
          </div>
          <p className="text-xs font-code-sm text-[#54675D] mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="material-symbols-outlined text-[14px]">{p.status === 'scheduled' ? 'schedule' : p.status === 'posted' ? 'check_circle' : 'info'}</span>
            {when}{username && <span className="text-[#54675D]/80">· @{username}</span>}
          </p>
          {p.caption && <p className="text-[13px] text-[#506359] mt-2 line-clamp-2">{p.caption}</p>}
          {p.status === 'failed' && p.error && <p className="text-xs text-[#C93A2E] mt-1.5">{p.error.message}</p>}
          {p.paused && <p className="text-xs text-[#B36B00] mt-1.5">Waiting for you to reconnect Instagram.</p>}
          {p.lateByMs && p.lateByMs > 5 * 60_000 && <p className="text-xs text-[#B36B00] mt-1.5">Went out {Math.round(p.lateByMs / 60_000)} minutes after its time.</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {p.permalink && (
            <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 rounded-xl border border-[#D3DBD0] bg-white hover:bg-[#E1E7DF] text-xs font-ui-medium font-semibold text-[#0F2A20] flex items-center gap-1">
              View on Instagram<span className="material-symbols-outlined text-[14px]">north_east</span>
            </a>
          )}
          <Link href={`/videos/${p.videoId}/post`} className="px-3.5 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold">
            {p.status === 'scheduled' || p.status === 'failed' ? 'Manage' : 'Open'}
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/sign-in');
  const asked = (await searchParams).show;
  const filter: Filter = FILTERS.some(([k]) => k === asked) ? (asked as Filter) : 'all';
  const [items, { connection }] = await Promise.all([listPosts(ctx.userId, storage()), getConnection(ctx.userId)]);
  const upcoming = items.filter(isUpcoming);
  const shown = (filter === 'upcoming' ? [...upcoming].reverse() : items.filter((p) => matches(p, filter)));
  const count = (f: Filter) => items.filter((p) => matches(p, f)).length;

  return (
    <main className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-0 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="font-headline-lg text-4xl text-[#0F2A20] tracking-tight font-bold">Posts</h1>
          <p className="text-[15px] text-[#506359] mt-1.5">
            Your scheduled and published Instagram reels{connection ? <> on <strong className="text-[#0F2A20]">@{connection.username}</strong></> : ''}. Times are in {ctx.timeZone}.
          </p>
        </div>
        <Link href="/create" className="btn-lift self-start sm:self-auto px-5 py-3 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-sm font-ui-medium font-semibold flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>New video
        </Link>
      </div>

      {connection?.status === 'needs_reconnect' && (
        <div role="alert" className="mb-6 p-4 rounded-2xl bg-[#FFF9F0] border border-[#F3CCA1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-[#0F2A20]"><strong>Instagram needs you to sign in again.</strong> Scheduled posts wait until you reconnect.</p>
          <Link href="/settings" className="px-4 py-2 rounded-xl bg-[#B36B00] hover:bg-[#8F5500] text-white text-sm font-ui-medium font-semibold text-center">Reconnect</Link>
        </div>
      )}
      {!connection && (
        <div className="mb-6 p-4 rounded-2xl bg-[#EEF1EC] border border-dashed border-[#B9C5B5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-[#0F2A20]"><strong>No Instagram account connected.</strong> Connect one to post and schedule from Vidyareel.</p>
          <Link href="/settings" className="px-4 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-sm font-ui-medium font-semibold text-center">Connect Instagram</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <Tile icon="event_upcoming" label="Upcoming" value={upcoming.length} tone="bg-[#FFF9EE] text-[#B36B00]" />
        <Tile icon="check_circle" label="Published" value={count('published')} tone="bg-[#E7FFF2] text-[#1A8F5A]" />
        <Tile icon="error" label="Failed or cancelled" value={count('attention')} tone="bg-[#FDF3F2] text-[#C93A2E]" />
      </div>

      <nav aria-label="Filter posts" className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k} href={k === 'all' ? '/posts' : `/posts?show=${k}`} aria-current={filter === k ? 'page' : undefined}
            className={`px-3.5 py-1.5 rounded-full text-xs font-code-sm border transition-colors ${filter === k ? 'bg-[#145A41] border-[#145A41] text-white' : 'bg-[#E1E7DF] border-transparent text-[#0F2A20] hover:bg-[#D3DBD0]'}`}
          >{label} <span className="opacity-70">{count(k)}</span></Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#B9C5B5] bg-white p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E1E7DF] border border-[#D3DBD0] mx-auto flex items-center justify-center text-[#145A41] mb-4"><span className="material-symbols-outlined text-[28px]">send</span></div>
          <p className="font-headline-md text-xl text-[#0F2A20] font-bold">{items.length ? 'Nothing in this view' : 'No posts yet'}</p>
          <p className="text-sm text-[#54675D] mt-1">{items.length ? 'Try another filter.' : 'When you post or schedule a video it shows up here.'}</p>
          <Link href={items.length ? '/posts' : '/library'} className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-sm font-ui-medium font-semibold">{items.length ? 'Show all posts' : 'Open your library'}</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">{shown.map((p) => <Row key={p.id} p={p} tz={ctx.timeZone} username={connection?.username ?? null} />)}</ul>
      )}
    </main>
  );
}
