'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MUSIC } from '@/config/music';
import { VOICES } from '@/config/voices';
import { api, type ApiError } from '@/lib/client-api';
import { clock } from '@/lib/time';
import type { getRenderStatus } from '@/server/render/jobs';
import type { VideoView } from '@/server/videos/view';
import { Stepper } from '../create/Stepper';
import { useToast } from '../shell/Toast';
import { FixScenePanel } from './FixScenePanel';
import { VideoPlayer } from './VideoPlayer';

export type RenderStatus = Awaited<ReturnType<typeof getRenderStatus>>;
type Media = NonNullable<RenderStatus['media']>;

const STAGES = ['Writing voice', 'Building scenes', 'Rendering video', 'Finishing'] as const;
const LANGUAGES: Record<string, string> = { en: 'English', hi: 'Hindi' };
const THEMES: Record<string, string> = { forest: 'Forest', saffron: 'Saffron', sage: 'Sage Dark', chalkboard: 'Chalkboard', blackboard: 'Blackboard', slate: 'Slate Blue', rose: 'Rose Paper', ocean: 'Ocean', maroon: 'Maroon Board', teal: 'Teal Board', plum: 'Plum Board', olive: 'Olive Board' };
const CARD = 'bg-white rounded-[24px] border border-[#D3DBD0] shadow-[0_4px_20px_-2px_rgba(20,90,65,0.06),0_2px_6px_-1px_rgba(20,90,65,0.04)]';
const PRIMARY = 'btn-lift px-5 py-3 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white font-headline-sm text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60';
const SECONDARY = 'btn-lift px-5 py-3 rounded-xl bg-white hover:bg-[#E1E7DF] border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-sm flex items-center justify-center gap-2';

/** Generate, Step 3 (Stitch "Create — Step 3: Generate"): Rendering, Ready and Failed, plus the cancel confirmation and Fix a scene. */
export function GenerateClient({ initialVideo, initialStatus, autoStart }: { initialVideo: VideoView; initialStatus: RenderStatus; autoStart: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [video, setVideo] = useState(initialVideo);
  const [status, setStatus] = useState(initialStatus);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [media, setMedia] = useState<Media | null>(initialStatus.media);
  const started = useRef(false);
  const lastLinks = useRef(Date.now());

  const rendering = status.videoStatus === 'rendering' || starting;

  const refresh = useCallback(async () => {
    const [s, v] = await Promise.all([api<RenderStatus>(`/api/videos/${video.id}/render/status`), api<VideoView>(`/api/videos/${video.id}`)]);
    if (s.ok) { setStatus(s.data); setMedia(s.data.media); }
    if (v.ok) setVideo(v.data);
    return s.ok ? s.data : null;
  }, [video.id]);

  // Poll every 3 seconds while a render is queued or running (API-Design 4).
  useEffect(() => {
    if (status.videoStatus !== 'rendering') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const s = await api<RenderStatus>(`/api/videos/${video.id}/render/status`);
      if (stop) return;
      if (s.ok) {
        setStatus(s.data);
        if (s.data.videoStatus !== 'rendering') { setMedia(s.data.media); const v = await api<VideoView>(`/api/videos/${video.id}`); if (v.ok && !stop) setVideo(v.data); return; }
      }
      timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 1500);
    return () => { stop = true; clearTimeout(timer); };
  }, [status.videoStatus, video.id]);

  const start = useCallback(async (version = video.version, sceneIds?: string[]) => {
    setStarting(true);
    setStartError(null);
    const res = await api<unknown>(`/api/videos/${video.id}/render`, {
      body: { version, ...(sceneIds ? { sceneIds } : {}) }, headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (!res.ok) { setStartError(res.error); setStarting(false); if (res.error.code === 'VERSION_CONFLICT') void refresh(); return false; }
    await refresh();
    setStarting(false);
    return true;
  }, [refresh, video.id, video.version]);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    if (video.status === 'storyboard_ready') void start();
    router.replace(`/videos/${video.id}/generate`);
  }, [autoStart, router, start, video.id, video.status]);

  async function cancel() {
    setCancelling(true);
    const res = await api<RenderStatus>(`/api/videos/${video.id}/render/cancel`, { method: 'POST', body: {} });
    setCancelling(false);
    setConfirmCancel(false);
    if (!res.ok) { toast('error', res.error.message); void refresh(); return; }
    toast('success', 'Render cancelled. Your script is saved.');
    if (res.data.videoStatus === 'ready') { await refresh(); return; }
    router.push(`/videos/${video.id}/review`);
  }

  // A signed link lasts an hour; when the player cannot load, ask for new ones, but not more than once a minute.
  async function freshLinks() {
    if (Date.now() - lastLinks.current < 60_000) return;
    lastLinks.current = Date.now();
    const m = await api<Media>(`/api/videos/${video.id}/media`);
    if (m.ok) setMedia(m.data);
  }

  const job = status.job;
  const done = status.videoStatus === 'ready' || status.videoStatus === 'scheduled' || status.videoStatus === 'posted';

  return (
    <div className="pb-16">
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-7 pb-4"><Stepper current={3} variant="stack" /></section>
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-6">
        {rendering ? (
          <RenderingPanel
            video={video} status={status} starting={starting} confirm={confirmCancel} cancelling={cancelling}
            onAskCancel={() => setConfirmCancel(true)} onKeep={() => setConfirmCancel(false)} onCancel={cancel}
          />
        ) : done ? (
          <ReadyView
            video={video} status={status} media={media} fixOpen={fixOpen} onFix={setFixOpen} onExpired={freshLinks}
            onRerender={async (version, sceneIds) => { const ok = await start(version, sceneIds); if (ok) setFixOpen(false); return ok; }}
            onVideo={setVideo} startError={startError}
          />
        ) : status.videoStatus === 'failed' ? (
          <FailedPanel video={video} status={status} error={startError} busy={starting} onRetry={() => start()} />
        ) : (
          <StartPanel video={video} error={startError} busy={starting} onStart={() => start()} />
        )}
        {job && job.warnings.length > 0 && done && (
          <p className="max-w-[640px] mx-auto mt-4 text-xs font-code-sm text-[#B36B00]" role="status">{job.warnings[0]}</p>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Rendering (State A) */

function RenderingPanel({ video, status, starting, confirm, cancelling, onAskCancel, onKeep, onCancel }: {
  video: VideoView; status: RenderStatus; starting: boolean; confirm: boolean; cancelling: boolean;
  onAskCancel: () => void; onKeep: () => void; onCancel: () => void;
}) {
  const job = status.job;
  const queued = !job || job.status === 'queued';
  const pct = starting && !job ? 0 : (job?.progress ?? 0);
  const at = queued ? -1 : Math.max(0, STAGES.indexOf(job!.stageLabel as (typeof STAGES)[number]));
  const n = video.scenes.length;
  // During the voice stage the progress moves from 5 to 30 across the scenes.
  const sceneNo = !queued && at === 0 ? Math.min(n, Math.floor(((Math.max(5, pct) - 5) / 25) * n) + 1) : null;
  const fix = job?.kind === 'fix';
  const doing = ['Recording the narration…', 'Lining the scenes up with the voice…', 'Rendering the frames…', 'Saving your video…'];
  const doneText = [`Recorded (${n} ${n === 1 ? 'scene' : 'scenes'})`, 'Scenes built', 'Video rendered', 'Saved'];

  return (
    <div>
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#D3DBD0] text-xs font-code-sm text-[#54675D] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C] animate-ping" />
          {fix ? 'Updating' : 'Rendering'} a {clock(video.estimatedSec)} reel · 9:16
        </span>
        <h1 className="font-headline-lg text-[28px] sm:text-4xl text-[#0F2A20] tracking-tight mb-2 font-bold">{fix ? 'Updating your video' : 'Making your video'}</h1>
        <p className="text-[#54675D] text-base">
          {fix
            ? 'We are recording the changed scene and putting the whole video together again.'
            : `We are recording the narration in ${VOICES.find((x) => x.id === video.voiceId)?.name ?? 'your chosen voice'}'s voice, building the scenes and rendering the final video.`}
        </p>
      </div>

      <div className={`${CARD} max-w-[640px] mx-auto p-6 sm:p-8 relative overflow-hidden`} aria-live="polite">
        <div className="flex items-baseline justify-between mb-4 gap-4">
          <div className="min-w-0">
            <span className="text-xs font-code-sm uppercase tracking-wider text-[#54675D] block mb-1">Current phase</span>
            <span className="font-headline-md text-xl sm:text-2xl text-[#0F2A20] font-bold flex flex-wrap items-center gap-x-2">
              {queued ? (starting && !job ? 'Starting' : 'In the queue') : job!.stageLabel}
              {sceneNo !== null && <span className="text-sm font-normal text-[#54675D] font-code-sm">(Scene {sceneNo} of {n})</span>}
            </span>
          </div>
          <span className="font-display text-5xl text-[#145A41] tracking-tighter font-bold tabular-nums" id="render-pct">{pct}%</span>
        </div>

        <div className="w-full h-3.5 bg-[#E1E7DF] rounded-full overflow-hidden mb-3 p-0.5 border border-[#D3DBD0]/40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full bg-gradient-to-r from-[#145A41] via-[#1A8F5A] to-[#FF9F1C] rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>

        <div className="flex items-center justify-between gap-3 text-xs font-code-sm text-[#54675D] mb-7 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-[#145A41]">schedule</span>
            {queued ? 'Waiting for a free slot' : job!.etaSec ? `About ${job!.etaSec} seconds left` : 'Estimating the time…'}
          </span>
          <span className="text-right">Target: {clock(video.estimatedSec)} · 1080×1920 HD</span>
        </div>

        <ol className="space-y-3 pt-4 border-t border-[#D3DBD0]/80 mb-7">
          {STAGES.map((label, i) => {
            const state = i < at ? 'done' : i === at ? 'now' : 'next';
            return (
              <li key={label} className={`flex items-center justify-between gap-3 text-sm py-1 ${state === 'now' ? 'bg-[#E1E7DF]/40 -mx-3 px-3 rounded-lg border border-[#B9C5B5]/40' : state === 'next' ? 'text-[#54675D]/70' : ''}`}>
                <div className="flex items-center gap-3">
                  {state === 'done' ? (
                    <div className="w-6 h-6 rounded-full bg-[#145A41] text-white flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-[14px]">check</span></div>
                  ) : state === 'now' ? (
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-[#145A41] flex items-center justify-center shadow-sm"><span className="w-2 h-2 rounded-full bg-[#145A41] animate-ping" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#EEF1EC] border border-[#B9C5B5] flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-[#B9C5B5]" /></div>
                  )}
                  <span className={state === 'now' ? 'font-semibold text-[#0F2A20]' : state === 'done' ? 'font-medium text-[#0F2A20]' : ''}>{label}</span>
                </div>
                {state === 'done' && (
                  <span className="font-code-sm text-xs text-[#1A8F5A] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" />{doneText[i]}</span>
                )}
                {state === 'now' && (
                  <span className="font-code-sm text-xs text-[#145A41] font-medium flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-[#145A41]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {doing[i]}
                  </span>
                )}
                {state === 'next' && <span className="font-code-sm text-xs text-[#54675D]/60">Queued</span>}
              </li>
            );
          })}
        </ol>

        <div className="bg-[#EEF1EC] rounded-xl p-3.5 border border-[#D3DBD0] flex items-start gap-3 mb-6">
          <span className="material-symbols-outlined text-[18px] text-[#54675D] mt-0.5">info</span>
          <p className="text-xs text-[#54675D] leading-relaxed">
            <strong className="text-[#0F2A20] font-medium">You can leave this page.</strong> Your video will appear in the{' '}
            <Link href="/library" className="text-[#145A41] underline hover:text-[#0F4632] font-medium">Library</Link> once rendering completes, and the bell at the top will tell you.
          </p>
        </div>

        {!confirm ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs font-code-sm text-[#54675D] truncate">Reel: “{video.title}”</span>
            <button
              type="button" onClick={onAskCancel}
              className="shrink-0 px-4 py-2 rounded-xl border border-[#D3DBD0] text-xs font-medium text-[#54675D] hover:text-[#C93A2E] hover:border-[#C93A2E]/40 hover:bg-[#FDF3F2] transition-colors"
            >Cancel render</button>
          </div>
        ) : (
          <div role="alertdialog" aria-label="Cancel this render?" className="mt-2 p-3 rounded-xl bg-[#FAF6F0] border border-[#B36B00]/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#0F2A20]">
              <span className="material-symbols-outlined text-[17px] text-[#B36B00]">warning</span>
              <span><strong>Cancel this render?</strong> Your script is kept and saved.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onKeep} className="px-3 py-1.5 rounded-xl bg-white border border-[#D3DBD0] text-xs font-medium text-[#0F2A20] hover:bg-[#E1E7DF] transition-colors">Keep going</button>
              <button type="button" onClick={onCancel} disabled={cancelling} className="px-3 py-1.5 rounded-xl bg-[#C93A2E] text-white text-xs font-medium hover:bg-[#A92A20] transition-colors disabled:opacity-60">
                {cancelling ? 'Cancelling…' : 'Cancel render'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Ready (State B) */

function ReadyView({ video, status, media, fixOpen, onFix, onExpired, onRerender, onVideo, startError }: {
  video: VideoView; status: RenderStatus; media: Media | null; fixOpen: boolean; onFix: (open: boolean) => void; onExpired: () => void;
  onRerender: (version: number, sceneIds: string[]) => Promise<boolean>; onVideo: (v: VideoView) => void; startError: ApiError | null;
}) {
  const job = status.job;
  const seconds = status.durationSec ?? Math.round(video.scenes.reduce((n, s) => n + (s.durationMs ?? 0), 0) / 1000);
  const voice = VOICES.find((x) => x.id === video.voiceId);
  const track = MUSIC.find((x) => x.id === video.musicId);
  const chip = {
    ready: { text: 'Ready to post', cls: 'bg-[#E7F6ED] border-[#1A8F5A]/30 text-[#1A8F5A]', dot: 'bg-[#1A8F5A] animate-pulse' },
    scheduled: { text: 'Scheduled', cls: 'bg-[#EAF3FB] border-[#C9DFF2] text-[#1F5E99]', dot: 'bg-[#2F7FC1]' },
    posted: { text: 'Posted', cls: 'bg-[#EEF1EC] border-[#D3DBD0] text-[#506359]', dot: 'bg-[#506359]' },
  }[status.videoStatus as 'ready' | 'scheduled' | 'posted'];
  const failedFix = job && job.status === 'failed' && job.kind === 'fix';
  const facts = [['Length', clock(seconds)], ['Resolution', '1080×1920'], ['Scenes', `${video.scenes.length} ${video.scenes.length === 1 ? 'Scene' : 'Scenes'}`], ['Language', LANGUAGES[video.language] ?? video.language]];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link href={`/videos/${video.id}/review`} className="inline-flex items-center gap-1 text-xs font-medium text-[#54675D] hover:text-[#145A41] transition-colors mb-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>Back to Script &amp; Storyboard
          </Link>
          <h1 className="font-headline-lg text-[26px] sm:text-3xl text-[#0F2A20] tracking-tight font-bold">Video Preview</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-code-sm font-medium ${chip.cls}`}>
            <span className={`w-2 h-2 rounded-full ${chip.dot}`} />{chip.text}
          </span>
          {job?.renderSec != null && job.status === 'succeeded' && <span className="text-xs font-code-sm text-[#54675D]">Generated in {job.renderSec < 60 ? `${job.renderSec}s` : `${Math.floor(job.renderSec / 60)}m ${job.renderSec % 60}s`}</span>}
        </div>
      </div>

      {failedFix && (
        <div role="alert" className="mb-6 p-3 rounded-xl bg-[#FDF3F2] border border-[#F4C8C5] text-[#C93A2E] text-[13px] flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>The last change did not finish: {job.error?.message ?? 'the video could not be updated.'} Your earlier video is unchanged.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex flex-col items-center">
          {media ? (
            <VideoPlayer src={media.videoUrl} poster={media.thumbUrl} onExpired={onExpired} />
          ) : (
            <div className="w-full max-w-[340px] aspect-[9/16] rounded-[24px] border border-[#D3DBD0] bg-white flex items-center justify-center text-sm text-[#54675D] text-center p-6">
              The video file is not available right now.
            </div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className={`${CARD} p-6`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <span className="text-xs font-code-sm text-[#54675D] uppercase tracking-wider block mb-1">Generated output</span>
                <h2 className="font-headline-md text-2xl text-[#0F2A20] font-bold leading-tight">{video.title}</h2>
                {video.topic && <p className="text-sm text-[#54675D] mt-1 line-clamp-2">{video.topic}</p>}
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#E1E7DF] text-[#0F2A20] text-xs font-code-sm font-medium shrink-0">{THEMES[video.theme] ?? video.theme}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4 border-y border-[#D3DBD0]/70 my-5">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-[#EEF1EC]/70 rounded-xl p-2.5 border border-[#D3DBD0] text-center">
                  <span className="block text-[10px] font-code-sm text-[#54675D] uppercase">{k}</span>
                  <span className="font-headline-sm text-lg text-[#0F2A20] font-bold">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs font-code-sm text-[#54675D] mb-6 gap-2">
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-[#145A41]">record_voice_over</span>Voice: <strong>{voice ? `${voice.name} (${voice.blurb})` : 'Default'}</strong></span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-[#FF9F1C]">palette</span>Theme: <strong>{THEMES[video.theme] ?? video.theme}</strong></span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-[#1A8F5A]">music_note</span>Music: <strong>{track ? track.name : 'None'}</strong></span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <Link href={`/videos/${video.id}/post`} className={`${PRIMARY} flex-1`}>
                <span>Continue to post</span><span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              {media ? (
                <a href={media.downloadUrl} download className={SECONDARY}>
                  <span className="material-symbols-outlined text-[18px] text-[#54675D]">download</span><span>Download MP4</span>
                </a>
              ) : (
                <button type="button" disabled className={`${SECONDARY} opacity-60`}><span className="material-symbols-outlined text-[18px]">download</span><span>Download MP4</span></button>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-[#D3DBD0] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#54675D]">Notice a phrasing or pacing mistake in one scene?</span>
              <button type="button" onClick={() => onFix(!fixOpen)} aria-expanded={fixOpen} className="text-xs font-medium text-[#145A41] hover:text-[#0F4632] flex items-center gap-1 underline underline-offset-2">
                <span className="material-symbols-outlined text-[15px]">tune</span>Fix a scene
              </button>
            </div>
          </div>

          {fixOpen && (
            <FixScenePanel video={video} startError={startError} onClose={() => onFix(false)} onRerender={onRerender} onVideo={onVideo} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Failed (State C) */

function FailedPanel({ video, status, error, busy, onRetry }: { video: VideoView; status: RenderStatus; error: ApiError | null; busy: boolean; onRetry: () => void }) {
  const job = status.job;
  const reason = error?.message ?? job?.error?.message ?? video.failureReason ?? 'The video could not be rendered. Please try again.';
  return (
    <div>
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF3F2] border border-[#F4C8C5] text-xs font-code-sm text-[#C93A2E] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C93A2E]" />Generation halted
        </span>
        <h1 className="font-headline-lg text-[28px] sm:text-4xl text-[#0F2A20] tracking-tight mb-2 font-bold">Video generation incomplete</h1>
        <p className="text-[#54675D] text-base">We hit a problem while turning your storyboard into the video.</p>
      </div>

      <div role="alert" className={`${CARD} max-w-[640px] mx-auto p-6 sm:p-8 relative overflow-hidden !border-2 !border-[#F4C8C5]`}>
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C93A2E]" />
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#FDF3F2] border border-[#F4C8C5] text-[#C93A2E] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[24px]">error</span></div>
          <div>
            <h2 className="font-headline-md text-2xl text-[#0F2A20] font-bold leading-tight">Rendering failed.</h2>
            <p className="text-sm text-[#54675D] mt-1">{reason} Your narration script and settings are safe.</p>
          </div>
        </div>

        <div className="bg-[#FDF3F2]/60 rounded-xl p-4 border border-[#F4C8C5]/80 mb-6 space-y-2">
          {job?.stageLabel && (
            <div className="flex items-center justify-between gap-3 text-xs font-code-sm text-[#0F2A20]">
              <span className="text-[#54675D]">Failed stage:</span><span className="font-semibold text-[#C93A2E]">{job.stageLabel}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-xs font-code-sm text-[#0F2A20]">
            <span className="text-[#54675D]">Daily quota impact:</span>
            <span className="text-[#1A8F5A] font-medium">0 videos charged (your slot is free again)</span>
          </div>
        </div>

        <div className="mb-7">
          <span className="text-xs font-code-sm uppercase text-[#54675D] block mb-2">Saved storyboard</span>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, video.scenes.length)}, minmax(0, 1fr))` }}>
            {video.scenes.map((s) => <div key={s.id} className="h-2 rounded bg-[#145A41]" title={`Scene ${s.order + 1}: saved`} />)}
          </div>
          <div className="text-[11px] font-code-sm text-[#54675D] mt-1.5">All {video.scenes.length} {video.scenes.length === 1 ? 'scene is' : 'scenes are'} saved. Voice that was already recorded is reused on the next try.</div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-2">
          <button type="button" onClick={onRetry} disabled={busy} className={`${PRIMARY} flex-1`}>
            <span className="material-symbols-outlined text-[18px]">refresh</span><span>{busy ? 'Starting…' : 'Try again'}</span>
          </button>
          <Link href={`/videos/${video.id}/review`} className={SECONDARY}>
            <span className="material-symbols-outlined text-[18px] text-[#54675D]">arrow_back</span><span>Back to review</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Before the first render */

function StartPanel({ video, error, busy, onStart }: { video: VideoView; error: ApiError | null; busy: boolean; onStart: () => void }) {
  const empty = video.status === 'draft' || video.scenes.length === 0;
  return (
    <div className={`${CARD} max-w-[640px] mx-auto p-6 sm:p-8 text-center`}>
      <div className="w-14 h-14 rounded-2xl bg-[#E1E7DF] border border-[#D3DBD0] mx-auto flex items-center justify-center text-[#145A41] mb-4"><span className="material-symbols-outlined text-[30px]">movie_edit</span></div>
      <h1 className="font-headline-md text-2xl text-[#0F2A20] font-bold mb-2">{empty ? 'Write the script first' : 'Ready to make your video'}</h1>
      <p className="text-sm text-[#54675D] mb-5">
        {empty ? 'This video has no storyboard yet. Open Review to write one.' : `“${video.title}” · ${video.scenes.length} scenes · about ${clock(video.estimatedSec)}. Rendering takes a few minutes, and you can leave the page while it runs.`}
      </p>
      {error && <p role="alert" className="mb-4 p-3 rounded-xl bg-[#FDF3F2] border border-[#F4C8C5] text-[#C93A2E] text-[13px]">{error.message}</p>}
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
        {!empty && <button type="button" onClick={onStart} disabled={busy} className={`${PRIMARY} sm:min-w-48`}>{busy ? 'Starting…' : 'Generate video'}</button>}
        <Link href={`/videos/${video.id}/review`} className={SECONDARY}><span className="material-symbols-outlined text-[18px] text-[#54675D]">arrow_back</span><span>Back to review</span></Link>
      </div>
    </div>
  );
}
