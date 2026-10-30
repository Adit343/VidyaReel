'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiError } from '@/lib/client-api';
import { dateTimeLabel, untilLabel, utcLabel, utcToZoned, zonedToUtc } from '@/lib/time';
import type { ConnectionView } from '@/server/instagram/connection';
import type { PostView } from '@/server/posts/service';
import type { mediaLinks } from '@/server/render/jobs';
import type { VideoView } from '@/server/videos/view';
import { Stepper } from '../create/Stepper';
import { VideoPlayer } from '../generate/VideoPlayer';
import { useToast } from '../shell/Toast';

type Media = NonNullable<Awaited<ReturnType<typeof mediaLinks>>>;
type Notice = 'cancelled' | 'not_eligible' | 'error' | null;

const MAX_CAPTION = 2200;
const MAX_TAGS = 30;
const CARD = 'bg-white rounded-[24px] border border-[#D3DBD0] shadow-[0_12px_32px_-8px_rgba(20,90,65,0.08)]';
const PRIMARY = 'btn-lift w-full py-3.5 px-6 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white font-ui-medium text-sm font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed';
const OUTLINE = 'btn-lift px-5 py-2.5 rounded-xl border border-[#D3DBD0] bg-white hover:bg-[#E1E7DF] text-xs font-ui-medium font-semibold text-[#0F2A20] flex items-center justify-center gap-1.5 transition-colors';
const FALLBACK_TAGS = ['#education', '#learning', '#explained', '#studytips', '#careertips'];

const tagCount = (s: string) => s.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;

/** The AI caption and its hashtags as one text the member can edit (Stitch: "Reel Caption & Hashtags"). */
function startingCaption(v: VideoView) {
  const tags = v.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).filter((t) => !v.caption.includes(t));
  return [v.caption.trim(), tags.join(' ')].filter(Boolean).join('\n\n');
}

const connectHref = (videoId: string) => `/api/instagram/connect?returnTo=${encodeURIComponent(`/videos/${videoId}/post`)}`;

/**
 * Post, Step 4 (Stitch "Create — Step 4: Post to Instagram"). Its seven states are one screen here, chosen from the
 * real data: Connected form, Not connected, Publishing, Posted, Scheduled, Failed and Already posted.
 */
export function PostClient({ initialVideo, initialMedia, initialConnection, initialPost, timeZone, flag }: {
  initialVideo: VideoView; initialMedia: Media | null; initialConnection: ConnectionView | null; initialPost: PostView | null;
  timeZone: string; flag: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const video = initialVideo;
  const [videoStatus, setVideoStatus] = useState(video.status);
  const [media, setMedia] = useState(initialMedia);
  const [connection, setConnection] = useState(initialConnection);
  const [post, setPost] = useState(initialPost);
  const [notice, setNotice] = useState<Notice>(flag === 'cancelled' || flag === 'not_eligible' || flag === 'error' ? flag : null);
  const [again, setAgain] = useState(false); // "Post it again" was pressed on a posted video
  const [repostOk, setRepostOk] = useState(false); // the member confirmed the repeat-post warning
  const [postedAt, setPostedAt] = useState<string | null>(null);
  const [newPost, setNewPost] = useState(false); // after a failure: write a fresh post instead of retrying
  const lastLinks = useRef(Date.now());
  const [, tick] = useState(0);

  // Come back from Meta: say what happened once, then tidy the address.
  useEffect(() => {
    if (!flag) return;
    if (flag === 'connected') toast('success', connection ? `Instagram connected as @${connection.username}.` : 'Instagram connected.');
    router.replace(`/videos/${video.id}/post`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshVideo = useCallback(async () => {
    const v = await api<VideoView>(`/api/videos/${video.id}`);
    if (v.ok) setVideoStatus(v.data.status);
  }, [video.id]);

  // Follow a live post: every 3 seconds while publishing, every 30 seconds while it waits for its time.
  const liveId = post && (post.status === 'publishing' || post.status === 'scheduled') ? post.id : null;
  const liveStatus = post?.status;
  useEffect(() => {
    if (!liveId) return;
    let stop = false;
    const timer = setInterval(async () => {
      const res = await api<PostView>(`/api/posts/${liveId}`);
      if (stop || !res.ok) return;
      setPost(res.data);
      if (res.data.status !== 'publishing' && res.data.status !== 'scheduled') void refreshVideo();
    }, liveStatus === 'publishing' ? 3000 : 30000);
    return () => { stop = true; clearInterval(timer); };
  }, [liveId, liveStatus, refreshVideo]);

  // The "in 18h 24m" text moves once a minute.
  useEffect(() => {
    if (post?.status !== 'scheduled') return;
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [post?.status]);

  async function freshLinks() {
    if (Date.now() - lastLinks.current < 60_000) return;
    lastLinks.current = Date.now();
    const m = await api<Media>(`/api/videos/${video.id}/media`);
    if (m.ok) setMedia(m.data);
  }

  const reloadConnection = useCallback(async () => {
    const c = await api<{ connection: ConnectionView | null }>('/api/instagram/connection');
    if (c.ok) setConnection(c.data.connection);
  }, []);

  const connected = connection?.status === 'connected';
  let view: 'publishing' | 'scheduled' | 'posted' | 'failed' | 'connect' | 'duplicate' | 'form';
  if (post?.status === 'publishing') view = 'publishing';
  else if (post?.status === 'scheduled') view = 'scheduled';
  else if (post?.status === 'failed' && !newPost) view = 'failed';
  else if (videoStatus === 'posted' && post?.status === 'posted' && !again) view = 'posted';
  else if (!connected) view = 'connect';
  else if (videoStatus === 'posted' && !repostOk) view = 'duplicate';
  else view = 'form';

  return (
    <div className="pb-16">
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-7 pb-4"><Stepper current={4} variant="stack" /></section>
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section className="lg:col-span-5 flex flex-col items-center gap-4">
            {media ? (
              <VideoPlayer src={media.videoUrl} poster={media.thumbUrl} onExpired={freshLinks} />
            ) : (
              <div className="w-full max-w-[340px] aspect-[9/16] rounded-[24px] border border-[#D3DBD0] bg-white flex items-center justify-center text-sm text-[#54675D] text-center p-6">
                The video file is not available right now.
              </div>
            )}
            <div className="w-full max-w-[340px] px-1 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-code-sm text-[#54675D] gap-3">
                <span className="text-[#0F2A20] font-medium truncate">{video.title}</span>
                <span className="shrink-0">1080×1920 · {video.scenes.length} {video.scenes.length === 1 ? 'scene' : 'scenes'}</span>
              </div>
              {media && (
                <a href={media.downloadUrl} download className="inline-flex items-center gap-2 text-xs font-ui-medium text-[#145A41] hover:text-[#0F4632] hover:underline self-start">
                  <span className="material-symbols-outlined text-[16px]">download</span>Download MP4 to post it yourself
                </a>
              )}
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className={`${CARD} p-6 sm:p-7 min-h-[520px]`}>
              {view === 'form' && connection && (
                <ComposeForm
                  video={video} connection={connection} timeZone={timeZone} repost={repostOk} notice={notice}
                  onPosted={(p) => { setPost(p); setVideoStatus('scheduled'); setNewPost(false); setAgain(false); }}
                  onAlreadyPosted={(at) => { setPostedAt(at); setRepostOk(false); setVideoStatus('posted'); }}
                  onReconnect={reloadConnection}
                />
              )}
              {view === 'connect' && <ConnectPanel videoId={video.id} reconnect={!!connection} notice={notice} onDismiss={() => setNotice(null)} />}
              {view === 'duplicate' && (
                <DuplicatePanel
                  username={connection?.username ?? ''} postedAt={postedAt ?? post?.updatedAt ?? null} timeZone={timeZone}
                  onCancel={() => { setAgain(false); }} onConfirm={() => setRepostOk(true)} backToPosted={post?.status === 'posted'}
                />
              )}
              {view === 'publishing' && post && <PublishingPanel post={post} username={connection?.username ?? ''} />}
              {view === 'scheduled' && post && (
                <ScheduledPanel
                  post={post} video={video} username={connection?.username ?? ''} timeZone={timeZone}
                  onChange={(p) => setPost(p)} onCancelled={() => { setPost(null); setVideoStatus('ready'); setNewPost(false); toast('success', 'Scheduled post cancelled.'); void refreshVideo(); }}
                  videoId={video.id}
                />
              )}
              {view === 'posted' && post && (
                <PostedPanel post={post} username={connection?.username ?? ''} timeZone={timeZone} onAgain={() => { setAgain(true); setRepostOk(false); }} />
              )}
              {view === 'failed' && post && (
                <FailedPanel
                  post={post} videoId={video.id} onRetry={(p) => { setPost(p); setVideoStatus('scheduled'); }}
                  onNew={() => setNewPost(true)} onReconnectNeeded={reloadConnection}
                />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ State 1: Connected (form) */

function AccountRow({ connection, videoId }: { connection: ConnectionView; videoId: string }) {
  const initials = connection.username.slice(0, 2).toUpperCase();
  return (
    <div className="p-3.5 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFDCBC] via-[#FF9F1C] to-[#145A41] p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#145A41] font-semibold text-xs">{initials}</div>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#145A41] rounded-full border-2 border-white flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[8px]">photo_camera</span>
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ui-medium text-sm font-semibold text-[#0F2A20] truncate">@{connection.username}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-code-sm bg-[#E7FFF2] text-[#1A8F5A] border border-[#A7E8C5]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" />Connected
            </span>
          </div>
          <span className="text-xs text-[#54675D]">{connection.accountType === 'CREATOR' ? 'Creator' : 'Business'} account</span>
        </div>
      </div>
      <a href={connectHref(videoId)} className="text-xs font-ui-medium text-[#145A41] hover:text-[#0F4632] hover:underline px-2 py-1 shrink-0">Change account</a>
    </div>
  );
}

function ComposeForm({ video, connection, timeZone, repost, notice, onPosted, onAlreadyPosted, onReconnect }: {
  video: VideoView; connection: ConnectionView; timeZone: string; repost: boolean; notice: Notice;
  onPosted: (p: PostView) => void; onAlreadyPosted: (postedAt: string | null) => void; onReconnect: () => void;
}) {
  const tomorrow = utcToZoned(new Date(Date.now() + 24 * 3600e3), timeZone).date;
  const today = utcToZoned(new Date(), timeZone).date;
  const [caption, setCaption] = useState(() => startingCaption(video));
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const at = timing === 'schedule' && date && time ? zonedToUtc(date, time, timeZone) : null;
  const inPast = at !== null && at.getTime() <= Date.now();
  const tags = tagCount(caption);
  const over = caption.length > MAX_CAPTION;
  const tooManyTags = tags > MAX_TAGS;
  const suggestions = [...video.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)), ...FALLBACK_TAGS]
    .filter((t, i, all) => all.indexOf(t) === i && !caption.toLowerCase().includes(t.toLowerCase())).slice(0, 5);
  const blocked = busy || over || tooManyTags || (timing === 'schedule' && (!at || inPast));

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api<{ post: PostView }>(`/api/videos/${video.id}/post`, {
      body: { caption, ...(at ? { scheduledAt: at.toISOString() } : {}), ...(repost ? { confirmRepost: true } : {}) },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    setBusy(false);
    if (res.ok) { onPosted(res.data.post); return; }
    if (res.error.code === 'ALREADY_POSTED') { onAlreadyPosted(typeof res.error.details?.postedAt === 'string' ? res.error.details.postedAt : null); return; }
    if (res.error.code === 'IG_NEEDS_RECONNECT' || res.error.code === 'IG_NOT_CONNECTED') onReconnect();
    setError(res.error);
  }

  const insertTag = (t: string) => setCaption((c) => `${c.trimEnd()} ${t}`.trimStart());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">Ready to publish</h1>
        <p className="text-sm text-[#54675D] mt-0.5">Post this reel to your Instagram Reels feed, now or at a time you pick.</p>
      </div>
      {notice === 'error' && <p role="alert" className="p-3 rounded-xl bg-[#FDF3F2] border border-[#F4C8C5] text-[#C93A2E] text-[13px]">Instagram did not finish connecting. Please try again.</p>}

      <AccountRow connection={connection} videoId={video.id} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="reel-caption" className="font-ui-medium text-xs font-semibold text-[#0F2A20] uppercase tracking-wide">Reel caption &amp; hashtags</label>
          <span className={`font-code-sm text-xs ${over ? 'text-[#C93A2E] font-semibold' : 'text-[#54675D]'}`} aria-live="polite">{caption.length} / {MAX_CAPTION}</span>
        </div>
        <textarea
          id="reel-caption" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)}
          className="w-full rounded-xl border border-[#D3DBD0] p-3.5 text-[15px] text-[#0F2A20] focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10 focus:outline-none resize-none transition-all"
        />
        {tooManyTags && <p className="text-xs text-[#C93A2E]">Instagram allows at most {MAX_TAGS} hashtags; this has {tags}.</p>}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-xs text-[#54675D] mr-1">Suggested:</span>
            {suggestions.map((t) => (
              <button key={t} type="button" onClick={() => insertTag(t)} className="text-xs font-code-sm px-2.5 py-1 rounded-full bg-[#E1E7DF] text-[#0F2A20] hover:bg-[#D3DBD0] transition-colors">+ {t}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-ui-medium text-xs font-semibold text-[#0F2A20] uppercase tracking-wide">Publishing timing</span>
        <div role="tablist" aria-label="Publishing timing" className="grid grid-cols-2 p-1 bg-[#E1E7DF] rounded-xl border border-[#D3DBD0]">
          {([['now', 'Post immediately'], ['schedule', 'Schedule for later']] as const).map(([k, label]) => (
            <button
              key={k} type="button" role="tab" aria-selected={timing === k} onClick={() => setTiming(k)}
              className={`py-2 text-xs font-ui-medium rounded-lg transition-all ${timing === k ? 'bg-white text-[#0F2A20] shadow-sm font-semibold' : 'text-[#54675D] hover:text-[#0F2A20]'}`}
            >{label}</button>
          ))}
        </div>
        {timing === 'schedule' && (
          <div className="flex flex-col gap-3 p-3.5 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0]">
            <SchedulePicker date={date} time={time} min={today} onDate={setDate} onTime={setTime} timeZone={timeZone} />
            {inPast && <p role="alert" className="text-xs text-[#C93A2E]">That time has passed. Pick a time in the future, or post now.</p>}
          </div>
        )}
      </div>

      {error && <p role="alert" className="p-3 rounded-xl bg-[#FDF3F2] border border-[#F4C8C5] text-[#C93A2E] text-[13px]">{error.message}</p>}

      <button type="button" onClick={submit} disabled={blocked} className={PRIMARY}>
        <span>{busy ? 'Sending…' : timing === 'now' ? `Post now to @${connection.username}` : at && !inPast ? `Schedule post for ${dateTimeLabel(at.toISOString(), timeZone)}` : 'Schedule post'}</span>
        {!busy && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
      </button>
    </div>
  );
}

function SchedulePicker({ date, time, min, onDate, onTime, timeZone }: {
  date: string; time: string; min: string; onDate: (v: string) => void; onTime: (v: string) => void; timeZone: string;
}) {
  const field = 'w-full bg-white rounded-xl border border-[#D3DBD0] px-3 py-2 text-xs font-ui-medium text-[#0F2A20] focus:border-[#145A41] focus:outline-none';
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-ui-medium text-[#54675D]">Publish date
          <input type="date" value={date} min={min} onChange={(e) => onDate(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-ui-medium text-[#54675D]">Publish time
          <input type="time" value={time} onChange={(e) => onTime(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-[#54675D]">
        <span className="material-symbols-outlined text-[14px]">public</span>
        <span>Your time zone:</span>
        <span className="font-code-sm font-medium text-[#0F2A20]">{timeZone} ({utcLabel(timeZone)})</span>
        <Link href="/settings" className="text-[#145A41] underline ml-1">Change</Link>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ State 2: Not connected */

function ConnectPanel({ videoId, reconnect, notice, onDismiss }: { videoId: string; reconnect: boolean; notice: Notice; onDismiss: () => void }) {
  const steps = [
    <>Press <strong>{reconnect ? 'Reconnect Instagram' : 'Connect Instagram'}</strong> below to go to Instagram&apos;s own sign-in page</>,
    'Log in there and allow Vidyareel to publish reels for you',
    'Choose a professional account (Creator or Business)',
    'You come back here and can post straight away',
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5 text-[#B36B00]">
        <span className="material-symbols-outlined text-[24px]">{reconnect ? 'sync_problem' : 'link_off'}</span>
        <span className="font-code-sm text-xs uppercase tracking-wider font-semibold">{reconnect ? 'Connection expired' : 'Account not linked'}</span>
      </div>
      <div>
        <h1 className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">{reconnect ? 'Reconnect your Instagram account' : 'Connect your Instagram account'}</h1>
        <p className="text-sm text-[#54675D] mt-1">
          {reconnect
            ? 'Instagram needs you to sign in again before Vidyareel can post. Your video and caption are safe, and scheduled posts will go out once you reconnect.'
            : 'Let Vidyareel publish your reels to your own Instagram account. We never see your password.'}
        </p>
      </div>

      {notice === 'cancelled' && <Banner tone="info" onDismiss={onDismiss}>You cancelled. No changes were made.</Banner>}
      {notice === 'error' && <Banner tone="error" onDismiss={onDismiss}>Instagram did not finish connecting. Please try again.</Banner>}
      {notice === 'not_eligible' && (
        <div role="alert" className="p-4 bg-[#FFF9EE] rounded-xl border border-[#F5DCB7] text-sm text-[#0F2A20]">
          <p className="font-semibold text-[#B36B00] flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">info</span>That account cannot post reels yet</p>
          <p className="text-xs text-[#54675D] mt-1.5">Instagram only lets professional accounts publish from other apps. Switching is free and takes a minute:</p>
          <ol className="text-xs text-[#0F2A20] mt-2 list-decimal pl-5 space-y-1">
            <li>In the Instagram app, open your profile and tap the menu, then <strong>Settings</strong>.</li>
            <li>Choose <strong>Account type and tools</strong>, then <strong>Switch to professional account</strong>.</li>
            <li>Pick <strong>Creator</strong> (or Business), finish the steps, and press Try again below.</li>
          </ol>
        </div>
      )}

      <ol className="p-4 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0] flex flex-col gap-3.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-[#145A41] text-white text-[11px] font-code-sm flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <span className="text-xs text-[#0F2A20]">{s}</span>
          </li>
        ))}
      </ol>

      <div className="p-3.5 bg-[#FFF9EE] rounded-xl border border-[#F5DCB7] flex items-start gap-2.5 text-xs text-[#B36B00]">
        <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
        <span>Personal accounts cannot publish reels from other apps. Your account must be a Creator or Business (professional) account.</span>
      </div>

      <div className="pt-1 flex flex-col gap-2">
        <a href={connectHref(videoId)} className={PRIMARY}>
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span>{notice === 'not_eligible' || notice === 'error' ? 'Try again' : reconnect ? 'Reconnect Instagram' : 'Connect Instagram'}</span>
        </a>
        <Link href={`/videos/${videoId}/generate`} className="text-xs text-[#54675D] hover:underline self-center py-1">Not now, back to my video</Link>
      </div>
    </div>
  );
}

function Banner({ tone, children, onDismiss }: { tone: 'info' | 'error'; children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div role="status" className={`p-3 rounded-xl border text-[13px] flex items-center justify-between gap-3 ${tone === 'error' ? 'bg-[#FDF3F2] border-[#F4C8C5] text-[#C93A2E]' : 'bg-[#EEF1EC] border-[#D3DBD0] text-[#0F2A20]'}`}>
      <span>{children}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="text-[#54675D] hover:text-[#0F2A20]"><span className="material-symbols-outlined text-[16px]">close</span></button>
    </div>
  );
}

/* ------------------------------------------------------------------ State 3: Publishing */

function PublishingPanel({ post, username }: { post: PostView; username: string }) {
  const processing = post.stage === 'processing';
  return (
    <div className="flex flex-col justify-center items-center py-10 gap-6 text-center" aria-live="polite">
      <div className="w-16 h-16 rounded-3xl bg-[#E7FFF2] border border-[#A7E8C5] flex items-center justify-center text-[#145A41]">
        <span className="material-symbols-outlined text-[32px] animate-spin">sync</span>
      </div>
      <div className="max-w-md">
        <h1 className="font-headline-md text-2xl text-[#0F2A20] font-bold">Posting to Instagram…</h1>
        <p className="text-xs text-[#54675D] mt-2">
          {processing ? 'Instagram is processing your video' : 'Handing your video to Instagram'}
          {username && <> for <span className="font-semibold text-[#0F2A20]">@{username}</span></>}. This usually takes one to two minutes, and you can leave this page.
        </p>
      </div>
      <div className="w-full max-w-md flex flex-col gap-2">
        <div className="w-full h-2.5 bg-[#E1E7DF] rounded-full overflow-hidden p-0.5 border border-[#D3DBD0]" role="progressbar" aria-label="Publishing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={processing ? 70 : 30}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#145A41] via-[#1A8F5A] to-[#FF9F1C] transition-all duration-1000" style={{ width: processing ? '70%' : '30%' }} />
        </div>
        <div className="flex justify-between text-[11px] font-code-sm text-[#54675D]">
          <span>{processing ? 'Sent to Instagram' : 'Sending the video'}</span>
          <span className="text-[#B36B00] font-semibold">{processing ? 'Instagram is processing' : 'Starting'}</span>
        </div>
      </div>
      <button type="button" disabled className="py-3 px-8 rounded-xl bg-[#E1E7DF] text-[#54675D] font-ui-medium text-xs cursor-not-allowed border border-[#D3DBD0]">Publishing in progress…</button>
    </div>
  );
}

/* ------------------------------------------------------------------ State 4: Posted */

function PostedPanel({ post, username, timeZone, onAgain }: { post: PostView; username: string; timeZone: string; onAgain: () => void }) {
  const late = post.lateByMs && post.lateByMs > 5 * 60_000 ? Math.round(post.lateByMs / 60_000) : null;
  return (
    <div className="flex flex-col justify-center items-center py-8 gap-5 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E7FFF2] text-[#1A8F5A] border border-[#A7E8C5] flex items-center justify-center">
        <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      </div>
      <div className="max-w-md">
        <h1 className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">Posted to @{username}</h1>
        <p className="text-sm text-[#54675D] mt-1.5">Your reel is live on your Instagram profile.</p>
      </div>
      <div className="w-full max-w-sm p-3.5 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0] flex items-center justify-between text-left gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#145A41] text-white flex items-center justify-center text-xs font-semibold shrink-0">IG</div>
          <div className="leading-tight min-w-0">
            <span className="text-xs font-semibold text-[#0F2A20] block">Instagram reel</span>
            <span className="text-[11px] font-code-sm text-[#54675D]">Published {dateTimeLabel(post.updatedAt, timeZone)}</span>
          </div>
        </div>
        <span className="font-code-sm text-[11px] text-[#1A8F5A] font-semibold bg-[#E7FFF2] px-2 py-0.5 rounded border border-[#A7E8C5]">Live</span>
      </div>
      {late && <p className="text-xs text-[#B36B00]">It went out about {late} minutes after the time you picked, because the service was busy.</p>}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} w-full py-3`}>
            <span>View on Instagram</span><span className="material-symbols-outlined text-[14px]">north_east</span>
          </a>
        )}
        <Link href="/create" className="btn-lift w-full py-3 px-5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white font-ui-medium text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
          <span>Make another video</span><span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
      <div className="flex items-center gap-4 text-xs text-[#54675D]">
        <Link href="/library" className="hover:underline">Back to library</Link>
        <button type="button" onClick={onAgain} className="hover:underline">Post it again</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ State 5: Scheduled */

function ScheduledPanel({ post, video, videoId, username, timeZone, onChange, onCancelled }: {
  post: PostView; video: VideoView; videoId: string; username: string; timeZone: string; onChange: (p: PostView) => void; onCancelled: () => void;
}) {
  const toast = useToast();
  const when = post.scheduledAt!;
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = utcToZoned(new Date(when), timeZone);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [error, setError] = useState<string | null>(null);
  const next = date && time ? zonedToUtc(date, time, timeZone) : null;
  const inPast = next !== null && next.getTime() <= Date.now();

  async function save() {
    if (!next) return;
    setBusy(true); setError(null);
    const res = await api<PostView>(`/api/posts/${post.id}`, { method: 'PATCH', body: { scheduledAt: next.toISOString() } });
    setBusy(false);
    if (!res.ok) { setError(res.error.message); return; }
    onChange(res.data); setEdit(false); toast('success', 'New time saved.');
  }
  async function cancel() {
    setBusy(true); setError(null);
    const res = await api<PostView>(`/api/posts/${post.id}`, { method: 'PATCH', body: { cancel: true } });
    setBusy(false);
    if (!res.ok) { setError(res.error.message); setConfirm(false); return; }
    onCancelled();
  }

  return (
    <div className="flex flex-col justify-center items-center py-8 gap-5 text-center">
      <div className={`w-16 h-16 rounded-full border flex items-center justify-center ${post.paused ? 'bg-[#FDF3F2] border-[#F4C8C5] text-[#C93A2E]' : 'bg-[#FFF9EE] border-[#F5DCB7] text-[#FF9F1C]'}`}>
        <span className="material-symbols-outlined text-[32px]">{post.paused ? 'pause_circle' : 'event_upcoming'}</span>
      </div>
      <div className="max-w-md">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EE] text-[#B36B00] border border-[#F5DCB7] font-code-sm text-xs font-medium mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />{post.paused ? 'Paused: reconnect Instagram' : 'Scheduled to post'}
        </span>
        <h1 className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">{dateTimeLabel(when, timeZone)}</h1>
        <p className="text-xs text-[#54675D] font-code-sm mt-1">Your time zone: {timeZone}</p>
      </div>

      <div className="w-full max-w-md p-4 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0] text-left flex flex-col gap-2">
        {[
          ['Posting to', `@${username}`],
          ['Video', video.title],
          ['Status', post.paused ? 'Waiting for you to reconnect' : `Waiting for its time (${untilLabel(when)})`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 text-xs"><span className="text-[#54675D]">{k}</span><span className="font-semibold text-[#0F2A20] text-right truncate">{v}</span></div>
        ))}
      </div>

      {post.paused && (
        <a href={connectHref(videoId)} className="btn-lift px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">sync_lock</span>Reconnect Instagram
        </a>
      )}

      {edit && (
        <div className="w-full max-w-md flex flex-col gap-3 p-3.5 bg-[#EEF1EC] rounded-2xl border border-[#D3DBD0] text-left">
          <SchedulePicker date={date} time={time} min={utcToZoned(new Date(), timeZone).date} onDate={setDate} onTime={setTime} timeZone={timeZone} />
          {inPast && <p role="alert" className="text-xs text-[#C93A2E]">That time has passed. Pick a time in the future.</p>}
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => setEdit(false)} className={OUTLINE}>Never mind</button>
            <button type="button" onClick={save} disabled={busy || !next || inPast} className="btn-lift px-5 py-2.5 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save new time'}</button>
          </div>
        </div>
      )}

      {confirm && (
        <div role="alertdialog" aria-label="Cancel this scheduled post?" className="w-full max-w-md p-3 rounded-xl bg-[#FAF6F0] border border-[#B36B00]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2 text-xs text-[#0F2A20]"><span className="material-symbols-outlined text-[17px] text-[#B36B00]">warning</span><span><strong>Cancel this post?</strong> It will not be published. Your video stays in the library.</span></div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setConfirm(false)} className="px-3 py-1.5 rounded-xl bg-white border border-[#D3DBD0] text-xs font-medium text-[#0F2A20] hover:bg-[#E1E7DF]">Keep it</button>
            <button type="button" onClick={cancel} disabled={busy} className="px-3 py-1.5 rounded-xl bg-[#C93A2E] text-white text-xs font-medium hover:bg-[#A92A20] disabled:opacity-60">{busy ? 'Cancelling…' : 'Cancel post'}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-[#C93A2E]">{error}</p>}

      {!edit && !confirm && (
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setEdit(true)} className={OUTLINE}>Edit schedule</button>
          <button type="button" onClick={() => setConfirm(true)} className="px-5 py-2.5 rounded-xl bg-transparent hover:bg-[#FDF2F2] text-xs font-ui-medium text-[#C93A2E] transition-colors">Cancel schedule</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ State 6: Failed */

function FailedPanel({ post, videoId, onRetry, onNew, onReconnectNeeded }: {
  post: PostView; videoId: string; onRetry: (p: PostView) => void; onNew: () => void; onReconnectNeeded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const reconnect = post.error?.code === 'IG_NEEDS_RECONNECT' || post.error?.code === 'IG_NOT_CONNECTED';

  async function retry() {
    setBusy(true); setError(null);
    const res = await api<PostView>(`/api/posts/${post.id}/retry`, { method: 'POST', body: {} });
    setBusy(false);
    if (res.ok) { onRetry(res.data); return; }
    if (res.error.code === 'IG_NEEDS_RECONNECT' || res.error.code === 'IG_NOT_CONNECTED') onReconnectNeeded();
    setError(res.error);
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="alert" className="p-5 bg-[#FDF2F2] border border-[#F4C8C5] rounded-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[#C93A2E]">
          <span className="material-symbols-outlined text-[22px]">error</span>
          <h1 className="font-headline-sm text-base font-bold tracking-tight">Publishing failed</h1>
        </div>
        <p className="text-xs text-[#54675D] leading-relaxed">{post.error?.message ?? 'Instagram did not accept the post.'} Your video and caption are saved.</p>
        {error && <p className="text-xs text-[#C93A2E]">{error.message}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {reconnect ? (
            <a href={connectHref(videoId)} className="btn-lift px-4 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">sync_lock</span>Reconnect Instagram
            </a>
          ) : (
            <button type="button" onClick={retry} disabled={busy} className="btn-lift px-4 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-ui-medium font-semibold flex items-center gap-1.5 disabled:opacity-60">
              <span className="material-symbols-outlined text-[15px]">refresh</span>{busy ? 'Starting…' : 'Retry post'}
            </button>
          )}
          {reconnect && (
            <button type="button" onClick={retry} disabled={busy} className="px-4 py-2 rounded-xl border border-[#F4C8C5] bg-white hover:bg-red-50 text-[#C93A2E] text-xs font-ui-medium font-semibold disabled:opacity-60">
              {busy ? 'Starting…' : 'I reconnected, retry'}
            </button>
          )}
        </div>
      </div>
      <div className="p-3 bg-[#EEF1EC] rounded-xl border border-[#D3DBD0] flex items-center justify-between gap-3 text-xs text-[#54675D]">
        <span>Your video file is saved and ready to post.</span>
        <button type="button" onClick={onNew} className="font-ui-medium text-[#145A41] hover:underline shrink-0">Edit the caption instead</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ State 7: Already posted */

function DuplicatePanel({ username, postedAt, timeZone, onCancel, onConfirm, backToPosted }: {
  username: string; postedAt: string | null; timeZone: string; onCancel: () => void; onConfirm: () => void; backToPosted: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div role="alert" className="p-4 bg-[#FFF9EE] border border-[#F5DCB7] rounded-xl text-[#B36B00] flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 text-[#FF9F1C]">warning</span>
          <div>
            <h1 className="font-ui-medium text-xs font-bold text-[#B36B00]">Duplicate reel</h1>
            <p className="text-xs text-[#54675D] mt-0.5">
              This video was already posted to <strong className="text-[#0F2A20]">@{username}</strong>{postedAt && <> on {dateTimeLabel(postedAt, timeZone)}</>}. Do you want to post it again?
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end">
          {backToPosted && <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-lg border border-[#D3DBD0] bg-white text-xs text-[#54675D] hover:text-[#0F2A20]">Cancel</button>}
          <button type="button" onClick={onConfirm} className="px-3.5 py-1.5 rounded-lg bg-[#FF9F1C] hover:bg-[#e68d14] text-white font-ui-medium text-xs font-semibold">Post again anyway</button>
        </div>
      </div>
      <div className="opacity-60 pointer-events-none flex flex-col gap-3 pt-2" aria-hidden>
        <div className="h-10 bg-[#EEF1EC] rounded-xl border border-[#D3DBD0]" />
        <div className="h-24 bg-[#EEF1EC] rounded-xl border border-[#D3DBD0]" />
      </div>
    </div>
  );
}
