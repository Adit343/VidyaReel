'use client';
import Link from 'next/link';
import { useState } from 'react';
import { clock, whenLabel } from '@/lib/time';
import type { VideoCardData } from '@/server/videos/list';
import { FILTER_GROUPS, HOME_STATUS, nextStepFor } from '../video/status';

const FILTERS = [['all', 'All'], ['drafts', 'Drafts'], ['ready', 'Ready'], ['posted', 'Posted']] as const;
type Filter = (typeof FILTERS)[number][0];

type Props = {
  quota: { used: number; limit: number; resetsIn: string; tzLabel: string };
  videos: VideoCardData[];
  postedCount: number;
  timeZone: string;
};

export function HomeClient({ quota, videos, postedCount, timeZone }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const limited = quota.used >= quota.limit;
  const left = Math.max(0, quota.limit - quota.used);
  const pct = Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100));
  const shown = videos
    .filter((v) => filter === 'all' || (FILTER_GROUPS[filter] as readonly string[]).includes(v.status))
    .slice(0, 4);

  return (
    <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 sm:px-6 md:px-0 py-6 md:py-8 space-y-6 md:space-y-8">
      {limited && (
        <div className="rounded-2xl bg-[#FFF8EB] border border-[#FFDCBC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="status">
          <div className="flex items-start sm:items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#FF9F1C] shrink-0 mt-1 sm:mt-0" />
            <div>
              <span className="font-ui-medium text-ui-medium text-[#543000]">Daily production quota reached ({quota.used} of {quota.limit} used).</span>
              <span className="font-body-sm text-body-sm text-[#744400] ml-1">New generation slots replenish at 12:00 AM {quota.tzLabel}. You can still edit scripts and download existing files.</span>
            </div>
          </div>
          <span className="font-code-xs text-code-xs bg-[#FFDCBC] text-[#543000] px-3 py-1 rounded-full font-semibold self-start sm:self-auto whitespace-nowrap">Resets in {quota.resetsIn}</span>
        </div>
      )}

      <section aria-labelledby="console-heading" className="w-full">
        <div className="bg-white rounded-[24px] border border-[#D3DBD0] p-5 sm:p-8 hero-atelier-shadow">
          <div className="max-w-3xl mb-6">
            <div className="flex items-center gap-2 text-xs font-code-xs text-[#54675D] mb-2 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#145A41]" />
              <span>Explainer reels for everyone · 1080×1920 vertical</span>
            </div>
            <h1 id="console-heading" className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[#0F2A20] tracking-tight">
              Turn any idea into a 60-second reel anyone can follow.
            </h1>
            <p className="font-body-md text-body-md text-secondary mt-2">
              Start with a school or college topic, an exam concept, a workplace skill, or anything you want to explain. Vidyareel drafts a script and a scene-by-scene storyboard for you to review, then adds animation and voiceover.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {limited ? (
              <span className="px-5 py-2.5 rounded-xl bg-[#D3DBD0] text-[#54675D] font-ui-medium text-ui-medium flex items-center gap-2 cursor-not-allowed">
                Daily limit reached. Resets at 12:00 AM
                <span className="material-symbols-outlined text-base">lock_clock</span>
              </span>
            ) : (
              <Link href="/create" id="create-video-btn" className="px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] active:scale-[0.99] shadow-sm text-white font-ui-medium text-ui-medium transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-base">add</span>
                Create a new video
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            )}
            <span className="font-code-xs text-code-xs text-[#54675D] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#145A41]">auto_awesome</span>
              Drafts a script and storyboard you can edit before anything renders
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Production status and connections" className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-[16px] border border-[#D3DBD0] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-code-xs text-code-xs uppercase tracking-wider text-[#54675D]">Daily production quota</span>
              <p className="font-headline-lg text-headline-lg text-[#0F2A20] mt-1" id="metric-quota-number">
                {quota.used} <span className="text-secondary text-2xl font-normal">/ {quota.limit} today</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF1EC] border border-[#D3DBD0] text-[#54675D] whitespace-nowrap">
              <span className="material-symbols-outlined text-xs">schedule</span>
              <span className="font-code-xs text-code-xs">Resets in {quota.resetsIn}</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="w-full h-2.5 bg-[#E1E7DF] rounded-full overflow-hidden p-0.5">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%`, background: 'linear-gradient(90deg, #145A41 0%, #FF9F1C 100%)' }} />
            </div>
            <div className="flex justify-between items-center text-xs font-code-xs text-[#54675D]">
              <span>{pct}% capacity utilized</span>
              <span className="text-[#145A41] font-semibold">{left} generation{left === 1 ? '' : 's'} remaining</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#D3DBD0] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-code-xs text-code-xs uppercase tracking-wider text-[#54675D]">Connected delivery channel</span>
              <p className="font-headline-sm text-headline-sm text-[#0F2A20] mt-1.5">Instagram not connected</p>
              <p className="font-body-sm text-body-sm text-[#54675D] mt-0.5">Connect your account in Settings when posting becomes available.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF1EC] text-[#54675D] border border-[#D3DBD0] font-code-xs text-code-xs font-semibold whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#718278]" />Not connected
            </span>
          </div>
          <div className="mt-6 pt-4 border-t border-[#EEF1EC] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-code-xs text-[#0F2A20]">
              <span className="material-symbols-outlined text-sm text-[#145A41]">video_library</span>
              <span className="font-semibold">{postedCount} published</span>
              <span className="text-[#54675D]">so far</span>
            </div>
            <Link href="/settings" className="font-ui-medium text-ui-medium text-[#145A41] hover:underline flex items-center gap-1">
              <span>Manage pipeline</span>
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-videos-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <h2 id="recent-videos-heading" className="font-headline-md text-headline-md text-[#0F2A20] tracking-tight">Recent videos</h2>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#D3DBD0]" role="tablist" aria-label="Filter recent videos">
                {FILTERS.map(([key, label]) => (
                  <button
                    key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                    className={`px-3 py-1 text-xs font-ui-medium rounded-lg transition-colors ${filter === key ? 'bg-[#145A41] text-white' : 'text-[#54675D] hover:text-[#0F2A20]'}`}
                  >{label}</button>
                ))}
            </div>
          </div>
          <Link href="/library" className="font-ui-medium text-ui-medium text-[#145A41] hover:text-[#0F4632] flex items-center gap-1 group">
            <span>View all in Library</span>
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-0.5">arrow_forward</span>
          </Link>
        </div>

        {videos.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-[#B9C5B5] bg-white p-10 sm:p-12 text-center flex flex-col items-center justify-center space-y-4" id="view-state-empty">
            <div className="w-16 h-16 rounded-full bg-[#EEF1EC] flex items-center justify-center text-[#145A41]">
              <span className="material-symbols-outlined text-3xl">movie_edit</span>
            </div>
            <div className="max-w-md">
              <h3 className="font-headline-sm text-headline-sm text-[#0F2A20]">No videos yet in your atelier</h3>
              <p className="font-body-md text-body-md text-secondary mt-1">Create your first 60-second reel from any idea.</p>
            </div>
            <Link href="/create" className="px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white font-ui-medium text-ui-medium transition-all flex items-center gap-2">
              <span>Create a new video</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-[24px] border border-[#D3DBD0] bg-white p-10 text-center text-[#54675D]">Nothing in this view yet.</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {shown.map((v) => <RecentCard key={v.id} v={v} timeZone={timeZone} />)}
          </div>
        )}
      </section>

      <HowItWorks />
    </main>
  );
}

function RecentCard({ v, timeZone }: { v: VideoCardData; timeZone: string }) {
  const s = HOME_STATUS[v.status];
  const next = nextStepFor(v);
  const action =
    v.status === 'ready' ? { label: 'Publish', icon: 'send', cls: 'bg-[#145A41] hover:bg-[#0F4632] text-white' }
    : v.status === 'storyboard_ready' ? { label: 'Edit script', cls: 'border border-[#D3DBD0] hover:bg-[#EEF1EC] text-[#0F2A20]' }
    : v.status === 'draft' ? { label: 'Resume', icon: 'play_arrow', cls: 'bg-[#EEF1EC] hover:bg-[#DCE3D9] text-[#0F2A20]' }
    : v.status === 'failed' ? { label: 'Try again', icon: 'refresh', cls: 'border border-[#C93A2E]/40 text-[#C93A2E] hover:bg-[#FDF4F3]' }
    : { label: v.status === 'rendering' ? 'Progress' : v.status === 'scheduled' ? 'Schedule' : 'View post', icon: next.icon, cls: 'bg-[#EEF1EC] hover:bg-[#DCE3D9] text-[#0F2A20]' };

  return (
    <article className="bg-white rounded-[16px] border border-[#D3DBD0] p-2.5 sm:p-4 flex flex-col justify-between hover:border-[#145A41] transition-all group">
      <div className="space-y-3">
        <Link href={next.to(v.id)} className="block relative w-full aspect-[9/12] sm:aspect-[16/9] rounded-xl overflow-hidden bg-gradient-to-br from-[#0F2A20] to-[#145A41] border border-[#D3DBD0]" aria-label={`Open ${v.title}`}
          style={v.thumbUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10,32,22,.35), rgba(10,32,22,.1) 50%, rgba(10,32,22,.4)), url(${v.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <span className="absolute inset-0 flex items-center justify-center text-white/70">
            <span className="material-symbols-outlined text-[34px]">{v.status === 'failed' ? 'error' : v.status === 'rendering' ? 'autorenew' : 'play_circle'}</span>
            {v.render && <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[#FF9F1C] font-code-xs text-[10px]">{v.render.progress}%</span>}
          </span>
          {v.durationSec != null && <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white font-code-xs text-[10px]">{clock(v.durationSec).padStart(5, '0')}</span>}
          <span className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full border font-code-xs text-[10px] flex items-center gap-1 shadow-sm ${s.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.ping ? 'animate-pulse' : ''}`} />{s.label}
          </span>
        </Link>
        <div>
          <span className="font-code-xs text-code-xs text-[#54675D]">{v.sceneCount} scene{v.sceneCount === 1 ? '' : 's'}</span>
          <h3 className="font-ui-medium text-ui-medium text-[#0F2A20] line-clamp-1 group-hover:text-[#145A41] transition-colors mt-0.5">{v.title}</h3>
        </div>
      </div>
      <div className="mt-3 sm:mt-4 pt-3 border-t border-[#EEF1EC] flex flex-wrap items-center justify-between gap-2">
        <span className="font-code-xs text-[11px] text-[#54675D]">{whenLabel(v.updatedAt, timeZone)}</span>
        <Link href={next.to(v.id)} className={`px-2.5 py-1 rounded-lg font-ui-medium text-xs transition-colors flex items-center gap-1 ${action.cls}`}>
          <span>{action.label}</span>
          {action.icon && <span className="material-symbols-outlined text-xs">{action.icon}</span>}
        </Link>
      </div>
    </article>
  );
}

const STEPS = [
  ['01', 'Idea', 'Type any topic, concept or skill.', 'bg-[#145A41]', 'text-[#145A41]'],
  ['02', 'Review', 'Edit the script and scenes before anything renders.', 'bg-white border-[#145A41]', 'text-[#145A41]'],
  ['03', 'Generate', 'Creates motion graphics and synced English narration.', 'bg-white border-[#FF9F1C]', 'text-[#A86407]'],
  ['04', 'Post', 'Send it directly to your connected Instagram account.', 'bg-[#B9C5B5]', 'text-[#54675D]'],
] as const;

/** Mobile Home only (Stitch "How it works"): the four steps of the flow. */
function HowItWorks() {
  return (
    <section className="md:hidden bg-white rounded-[20px] border border-[#D3DBD0] p-4" aria-label="How it works">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#D3DBD0]/50">
        <h2 className="font-headline-sm text-[18px] font-bold text-[#0F2A20]">How it works</h2>
        <span className="font-code-xs text-[11px] text-[#54675D]">4-STEP PIPELINE</span>
      </div>
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2.5 top-2 bottom-3 w-[1.5px] bg-[#D3DBD0]" />
        {STEPS.map(([n, name, text, dot, num]) => (
          <div key={n} className="relative flex flex-col">
            <span className={`absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 ${dot.includes('border') ? dot : `${dot} border-white`}`} />
            <div className="flex items-baseline gap-2">
              <span className={`font-code-xs text-[11px] font-bold ${num}`}>{n}</span>
              <h3 className="font-ui-medium text-[14px] text-[#0F2A20]">{name}</h3>
            </div>
            <p className="font-body-sm text-[13px] text-[#54675D] mt-0.5 leading-snug">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
