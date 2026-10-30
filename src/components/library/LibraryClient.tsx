'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import type { VideoStatus } from '@/lib/schemas/video';
import { clock, whenLabel } from '@/lib/time';
import type { VideoCardData } from '@/server/videos/list';
import { useToast } from '../shell/Toast';
import { Select } from '../ui/Select';
import { nextStepFor } from '../video/status';

const PAGE = 8;
const FILTERS: [string, string, readonly VideoStatus[] | null][] = [
  ['all', 'All', null], ['draft', 'Draft', ['draft', 'storyboard_ready']], ['rendering', 'Rendering', ['rendering']],
  ['ready', 'Ready', ['ready']], ['scheduled', 'Scheduled', ['scheduled']], ['posted', 'Posted', ['posted']], ['failed', 'Failed', ['failed']],
];
const SORTS = ['Newest', 'Oldest', 'Title (A-Z)', 'Duration'] as const;

type Plate = { gradient: string; badge: string; badgeCls: string; icon: string; dot?: string };
const PLATE: Record<VideoStatus, Plate> = {
  ready: { gradient: 'bg-gradient-to-b from-[#0F2A20] to-[#145A41]', badge: 'Ready', badgeCls: 'bg-black/40 text-white', dot: 'bg-[#1A8F5A]', icon: 'play_circle' },
  rendering: { gradient: 'bg-gradient-to-b from-[#1B352B] to-[#0A2016]', badge: 'Synthesizing', badgeCls: 'bg-black/50 text-[#FF9F1C]', dot: 'bg-[#FF9F1C] animate-ping', icon: 'autorenew' },
  posted: { gradient: 'bg-[#1E2E25]', badge: 'Reel published', badgeCls: 'bg-black/40 text-white', dot: 'bg-[#1A8F5A]', icon: 'share' },
  draft: { gradient: 'bg-[#24332B]', badge: 'Draft note', badgeCls: 'bg-black/40 text-white', icon: 'subject' },
  storyboard_ready: { gradient: 'bg-gradient-to-b from-[#145A41] to-[#1E3B30]', badge: 'Storyboard', badgeCls: 'bg-black/40 text-white', dot: 'bg-[#8DCFAF]', icon: 'view_carousel' },
  scheduled: { gradient: 'bg-[#183327]', badge: 'Queued', badgeCls: 'bg-black/40 text-white', icon: 'alarm' },
  failed: { gradient: 'bg-[#2D1A1A]', badge: 'Error halted', badgeCls: 'bg-[#C93A2E] text-white', icon: 'error' },
};
const PILL: Record<VideoStatus, { label: string; cls: string; icon?: string; dot?: string }> = {
  ready: { label: 'Ready', cls: 'bg-[#1A8F5A]/10 text-[#1A8F5A] border border-[#1A8F5A]/20', dot: 'bg-[#1A8F5A]' },
  rendering: { label: 'Rendering', cls: 'text-[#0F2A20]', dot: 'bg-[#FF9F1C]' },
  posted: { label: 'Posted', cls: 'bg-[#1A8F5A]/10 text-[#1A8F5A] border border-[#1A8F5A]/20', icon: 'check_circle' },
  draft: { label: 'Draft', cls: 'bg-[#E1E7DF] text-[#0F2A20]' },
  storyboard_ready: { label: 'Storyboard ready', cls: 'bg-[#D0E5D8] text-[#00412D] border border-[#92D4B4]/50' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#FFF3E0] text-[#8C5200] border border-[#FFDCBC]', dot: 'bg-[#FF9F1C]' },
  failed: { label: 'Render failed', cls: 'bg-[#FFDAD6] text-[#93000A] border border-[#C93A2E]/30', icon: 'warning' },
};

export function LibraryClient({ videos: initial, timeZone }: { videos: VideoCardData[]; timeZone: string }) {
  const toast = useToast();
  const router = useRouter();
  const [videos, setVideos] = useState(initial);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Newest');
  const [shown, setShown] = useState(PAGE);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menuId]);

  // While a render is running, refresh the cards every 15 seconds (API-Design 4).
  const anyRendering = videos.some((v) => v.status === 'rendering');
  const refresh = useCallback(async () => {
    const res = await api<{ items: VideoCardData[] }>('/api/library?limit=100');
    if (res.ok) {
      // Cards that changed are replaced in place; older ones beyond the first 100 stay as they were.
      const fresh = new Map(res.data.items.map((c) => [c.id, c]));
      setVideos((cur) => cur.filter((c) => fresh.has(c.id) || !fresh.size || c.createdAt < res.data.items[res.data.items.length - 1].createdAt).map((c) => fresh.get(c.id) ?? c));
    }
  }, []);
  useEffect(() => {
    if (!anyRendering) return;
    const t = setInterval(() => { if (!document.hidden) void refresh(); }, 15_000);
    return () => clearInterval(t);
  }, [anyRendering, refresh]);

  const list = useMemo(() => {
    const statuses = FILTERS.find(([k]) => k === filter)?.[2];
    const needle = q.trim().toLowerCase();
    const out = videos.filter((v) => (!statuses || statuses.includes(v.status)) && (!needle || v.title.toLowerCase().includes(needle) || PILL[v.status].label.toLowerCase().includes(needle)));
    const by: Record<string, (a: VideoCardData, b: VideoCardData) => number> = {
      Newest: (a, b) => b.createdAt.localeCompare(a.createdAt), Oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      'Title (A-Z)': (a, b) => a.title.localeCompare(b.title), Duration: (a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0),
    };
    return [...out].sort(by[sort]);
  }, [videos, q, filter, sort]);

  async function remove(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' }).catch(() => null);
    setBusyId(null);
    if (res?.ok) {
      setVideos((all) => all.filter((v) => v.id !== id));
      setConfirmId(null);
      toast('success', 'Video deleted.');
    } else {
      toast('error', 'We could not delete that video. Please try again.');
    }
  }

  async function duplicate(id: string) {
    setMenuId(null);
    setBusyId(id);
    const res = await api<{ id: string }>(`/api/videos/${id}/duplicate`, { method: 'POST', body: {} });
    setBusyId(null);
    if (!res.ok) { toast('error', res.error.message); return; }
    toast('success', 'Copied. Review the script and generate it when you are ready.');
    router.push(`/videos/${res.data.id}/review`);
  }

  const reset = () => { setQ(''); setFilter('all'); };

  return (
    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-0 py-6 md:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[40px] leading-[44px] font-headline-lg font-bold text-[#0F2A20] tracking-[-0.03em]">Library</h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E1E7DF] border border-[#D3DBD0] text-[#0F2A20] text-code-xs font-code-xs">
            {videos.length} video{videos.length === 1 ? '' : 's'}
          </span>
        </div>
        <Link href="/create" className="btn-lift inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[12px] bg-[#145A41] text-white font-ui-medium text-ui-medium hover:bg-[#0F4632] shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create video</span>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-8">
          <div className="relative w-full lg:w-72">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#54675D]">search</span>
            <input
              id="search-input" type="text" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search videos" aria-label="Search videos"
              className="w-full bg-white border border-[#D3DBD0] rounded-[12px] pl-10 pr-9 py-2 text-body-md font-body-md text-[#0F2A20] placeholder-[#54675D] focus:outline-none focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/20 transition-all shadow-sm"
            />
            {q && (
              <button aria-label="Clear search" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#54675D] hover:text-[#0F2A20]">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1" role="group" aria-label="Filter by status">
            {FILTERS.map(([key, label]) => (
              <button
                key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setShown(PAGE); }}
                className={`px-3.5 py-1.5 rounded-full text-code-xs font-code-xs whitespace-nowrap transition-all border ${filter === key ? 'bg-[#145A41] text-white border-[#145A41]' : 'bg-[#E1E7DF] text-[#0F2A20] hover:bg-[#D3DBD0] border-transparent'}`}
              >{label}</button>
            ))}
          </div>
          <div className="self-end lg:self-auto min-w-[150px]">
            <Select
              value={sort} onChange={(v) => setSort(v as (typeof SORTS)[number])} ariaLabel="Sort videos" menuAlign="right"
              options={SORTS.map((s) => ({ value: s, label: s }))} className="font-ui-medium shadow-sm"
            />
          </div>
        </div>

      {videos.length === 0 ? (
        <div className="w-full rounded-[24px] border-2 border-dashed border-[#B9C5B5] bg-white p-12 md:p-16 text-center max-w-2xl mx-auto my-6 shadow-sm" id="view-empty-library">
          <div className="w-16 h-16 rounded-2xl bg-[#E1E7DF] border border-[#D3DBD0] mx-auto flex items-center justify-center text-[#145A41] mb-5 shadow-inner">
            <span className="material-symbols-outlined text-[32px]">video_library</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-[#0F2A20] mb-2 tracking-tight">No videos yet</h3>
          <p className="font-body-md text-body-md text-[#54675D] max-w-md mx-auto mb-7">
            Type any idea to make your first one. Vidyareel turns a topic into a script, a storyboard and a finished vertical video.
          </p>
          <Link href="/" className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-[12px] bg-[#145A41] text-white font-ui-medium text-ui-medium hover:bg-[#0F4632]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create your first video</span>
          </Link>
        </div>
      ) : list.length === 0 ? (
        <div className="w-full rounded-[24px] border border-[#D3DBD0] bg-white p-12 text-center max-w-xl mx-auto my-6" id="view-empty-search">
          <div className="w-14 h-14 rounded-full bg-[#E1E7DF] text-[#54675D] mx-auto flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">search_off</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-[#0F2A20] mb-2">
            {q.trim() ? <>Nothing matches “<span>{q.trim()}</span>”</> : 'No videos with this status'}
          </h3>
          <p className="font-body-md text-body-md text-[#54675D] mb-6">Check for spelling errors or try searching by topic or generation status.</p>
          <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#E1E7DF] text-[#0F2A20] font-ui-medium text-ui-medium hover:bg-[#D3DBD0] transition-colors">
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>{q.trim() ? 'Clear search' : 'Show all videos'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-10" id="view-grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {list.slice(0, shown).map((v) => (
              <Card
                key={v.id} v={v} timeZone={timeZone} confirming={confirmId === v.id} busy={busyId === v.id}
                menuOpen={menuId === v.id} menuRef={menuRef}
                onMenu={() => setMenuId(menuId === v.id ? null : v.id)}
                onAskDelete={() => { setMenuId(null); setConfirmId(v.id); }}
                onCancel={() => setConfirmId(null)} onDelete={() => void remove(v.id)} onDuplicate={() => void duplicate(v.id)}
              />
            ))}
          </div>
          {list.length > shown && (
            <div className="flex flex-col items-center justify-center pt-4 pb-8">
              <button onClick={() => setShown(shown + PAGE)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-ui-medium hover:bg-[#E1E7DF] hover:border-[#B9C5B5] transition-all shadow-sm active:scale-[0.99]">
                <span>Show more</span>
                <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
              </button>
              <span className="text-code-xs font-code-xs text-[#54675D] mt-2.5">Showing {Math.min(shown, list.length)} of {list.length} videos</span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Card({ v, timeZone, confirming, busy, menuOpen, menuRef, onMenu, onAskDelete, onCancel, onDelete, onDuplicate }: {
  v: VideoCardData; timeZone: string; confirming: boolean; busy: boolean; menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>; onMenu: () => void; onAskDelete: () => void; onCancel: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const meta = [v.durationSec != null ? clock(v.durationSec) : null, `${v.sceneCount} scene${v.sceneCount === 1 ? '' : 's'}`, 'English', whenLabel(v.createdAt, timeZone).replace(/^Today, .*/, 'Today')]
    .filter(Boolean).join(' · ');

  if (confirming) {
    return (
      <article className="bg-white rounded-[16px] border-2 border-[#C93A2E]/60 p-4 flex flex-col justify-between relative overflow-hidden shadow-md" aria-label={`Confirm deleting ${v.title}`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFDAD6] text-[#93000A] font-code-xs text-[10px] font-semibold">
              <span className="material-symbols-outlined text-[13px]">delete</span> Confirm action
            </span>
            <span className="text-code-xs font-code-xs text-[#54675D]">ID #{v.id.slice(-4)}</span>
          </div>
          <h3 className="font-headline-sm text-[18px] leading-[22px] font-bold text-[#0F2A20] mb-2">{v.title}</h3>
          <p className="font-code-xs text-code-xs text-[#54675D] mb-4">{meta}</p>
          <div className="bg-[#FFDAD6]/40 border border-[#FFDAD6] rounded-[12px] p-3 mb-4">
            <p className="font-ui-medium text-[13px] leading-snug text-[#93000A] font-semibold mb-1">Delete this video?</p>
            <p className="text-[12px] leading-relaxed text-[#54675D]">This removes it from your Library. Its generated files are cleaned up shortly after.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-[#EEF1EC]">
          <button onClick={onCancel} disabled={busy} className="flex-1 px-3 py-2 rounded-[10px] bg-white border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-[13px] hover:bg-[#E1E7DF] transition-colors">Cancel</button>
          <button onClick={onDelete} disabled={busy} className="flex-1 px-3 py-2 rounded-[10px] bg-[#C93A2E] text-white font-ui-medium text-[13px] hover:bg-[#93000A] transition-colors shadow-sm flex items-center justify-center gap-1 disabled:opacity-70">
            <span className="material-symbols-outlined text-[14px]">delete_forever</span>
            <span>{busy ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>
      </article>
    );
  }

  const plate = PLATE[v.status];
  const pill = PILL[v.status];
  const next = nextStepFor(v);
  const failed = v.status === 'failed';
  return (
    <article className="card-lift bg-white rounded-[16px] border border-[#D3DBD0] p-4 flex flex-col justify-between group relative">
      <div>
        <Link href={next.to(v.id)} aria-label={`Open ${v.title}`}
          style={v.thumbUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10,32,22,.55), rgba(10,32,22,.1) 40%, rgba(10,32,22,.7)), url(${v.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          className={`relative w-full aspect-[9/16] max-h-[260px] rounded-[12px] overflow-hidden ${v.thumbUrl ? 'bg-[#0F2A20]' : plate.gradient} border ${failed ? 'border-[#FFDAD6]/50' : 'border-[#B9C5B5]/40'} mb-3.5 flex flex-col justify-between p-3.5`}>
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-code-xs text-[10px] ${plate.badgeCls}`}>
              {plate.dot && <span className={`w-1.5 h-1.5 rounded-full ${plate.dot}`} />}{plate.badge}
            </span>
            <span className="material-symbols-outlined text-white/70 text-[18px]">{plate.icon}</span>
          </div>
          <div className={`my-auto text-center px-1 ${v.thumbUrl ? 'invisible' : ''}`}>
            <div className="w-10 h-10 rounded-full border border-dashed border-[#FF9F1C] mx-auto mb-2 flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF9F1C]" />
            </div>
            <p className="font-headline-sm text-white text-[15px] leading-tight font-bold line-clamp-3">{v.title}</p>
            <p className={`${failed ? 'text-[#FFDAD6]' : 'text-white/60'} font-code-xs text-[10px] mt-1`}>
              {failed ? 'Render did not finish' : `${v.sceneCount} scene${v.sceneCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex justify-between items-center text-white/80 font-code-xs text-[10px]">
            <span className="bg-black/40 px-1.5 py-0.5 rounded">{failed ? 'Retryable' : v.sceneCount > 1 ? `Sc. 1–${v.sceneCount}` : 'Sc. 1'}</span>
            <span className="bg-black/40 px-1.5 py-0.5 rounded font-mono">{v.durationSec != null ? clock(v.durationSec) : '--:--'}</span>
          </div>
        </Link>
        <h3 className={`font-headline-sm text-[18px] leading-[22px] font-bold text-[#0F2A20] mb-1 transition-colors line-clamp-1 ${failed ? 'group-hover:text-[#C93A2E]' : 'group-hover:text-[#145A41]'}`}>{v.title}</h3>
        <p className="font-code-xs text-code-xs text-[#54675D] mb-3">{meta}</p>
      </div>
      <div>
        {v.status === 'rendering' && (
          <div className="mb-2">
            <div className="flex justify-between items-center text-code-xs font-code-xs mb-1">
              <span className="text-[#0F2A20] font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />Rendering</span>
              <span className="text-[#54675D] tabular-nums">{v.render ? `${v.render.progress}%` : 'in progress'}</span>
            </div>
            <div className="w-full bg-[#E1E7DF] h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.render?.progress}>
              {v.render ? (
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(4, v.render.progress)}%`, background: 'linear-gradient(90deg,#145A41,#1A8F5A,#FF9F1C)' }} />
              ) : (
                <div className="h-full w-full shimmer-sage" style={{ background: 'linear-gradient(90deg,#145A41,#1A8F5A,#FF9F1C)', opacity: 0.6 }} />
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-[#EEF1EC]">
          {v.status === 'rendering' ? <span className="text-code-xs font-code-xs text-[#54675D]">{v.render?.stageLabel ?? 'Starting'}</span> : (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-code-xs text-[11px] font-medium ${pill.cls}`}>
              {pill.dot && <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />}
              {pill.icon && <span className="material-symbols-outlined text-[13px]">{pill.icon}</span>}
              {pill.label}
            </span>
          )}
          <div className="relative" ref={menuOpen ? menuRef : undefined}>
            <button onClick={onMenu} aria-haspopup="menu" aria-expanded={menuOpen} title="More options" aria-label={`More options for ${v.title}`}
              className="p-1 text-[#54675D] hover:text-[#0F2A20] hover:bg-[#E1E7DF] rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-[#B9C5B5] rounded-xl overlay-ambient-shadow py-1 z-20 text-left">
                <Link role="menuitem" href={next.to(v.id)} className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#0F2A20] hover:bg-[#EEF1EC]">
                  <span className="material-symbols-outlined text-[16px] text-[#54675D]">open_in_new</span>Open
                </Link>
                {v.sceneCount > 0 && (
                  <button role="menuitem" onClick={onDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#0F2A20] hover:bg-[#EEF1EC]">
                    <span className="material-symbols-outlined text-[16px] text-[#54675D]">content_copy</span>Duplicate
                  </button>
                )}
                <button role="menuitem" onClick={onAskDelete} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#C93A2E] hover:bg-[#FDF4F3]">
                  <span className="material-symbols-outlined text-[16px]">delete</span>Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <Link href={next.to(v.id)} className={`mt-2 text-[12px] font-ui-medium flex items-center gap-1 transition-all ${failed ? 'text-[#C93A2E] hover:underline' : 'text-[#145A41] opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5'}`}>
          <span>{next.label}</span>
          <span className="material-symbols-outlined text-[14px]">{next.icon}</span>
        </Link>
      </div>
    </article>
  );
}
