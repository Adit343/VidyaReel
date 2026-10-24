'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import type { VideoView } from '@/server/videos/view';
import { Stepper } from './Stepper';

const MAX = 500;
const LENGTHS = [30, 60, 90] as const;
const AUDIENCES = [
  ['Class 5', 'Class 5 (Ages 10-11)'], ['Class 7', 'Class 7 (Ages 12-13)'], ['Class 9', 'Class 9 (Ages 14-15)'], ['General', 'General / Foundational'],
] as const;
const ANGLES = [
  { id: 'everyday', icon: 'wb_twilight', title: 'Everyday example', text: 'Relates concept to familiar home or kitchen routines.' },
  { id: 'step', icon: 'conversion_path', title: 'Step by step', text: 'Sequential cause and effect mechanism breakdown.' },
  { id: 'mistake', icon: 'psychology_alt', title: 'Common mistake', text: 'Debunks student misconceptions first.' },
] as const;
type AngleId = (typeof ANGLES)[number]['id'];

type Idea = { label: string; text: string };
// Shown first and as the fallback; "Suggest more" asks the AI for fresh ones.
const POOL: Idea[] = [
  { label: 'Photosynthesis', text: 'Photosynthesis in leaf chloroplasts. Explain light and dark reactions for Class 7.' },
  { label: 'Water cycle', text: 'Water cycle and precipitation dynamics for Grade 7 earth science.' },
  { label: 'How vaccines work', text: 'How vaccines work and train the immune system with antibodies.' },
  { label: 'Why the sky is blue', text: 'Why the sky is blue and how Rayleigh scattering disperses sunlight.' },
  { label: 'Rainbows', text: 'Rainbows: Refraction, reflection, and dispersion through raindrops.' },
  { label: 'Seasons', text: 'Why do we have seasons? Axial tilt and Earth orbital path explained for Class 7.' },
  { label: 'Plate tectonics', text: 'Plate tectonics, fault lines, and why earthquakes happen.' },
  { label: "Newton's Third Law", text: "Newton's third law of motion: Action and reaction forces in sports." },
  { label: 'Mitochondria', text: 'Mitochondria: Cellular respiration and ATP production in animal cells.' },
];

type Banner =
  | { kind: 'unsafe' }
  | { kind: 'daily' }
  | { kind: 'failed'; message: string; videoId?: string; version?: number }
  | { kind: 'error'; message: string };

type Props = { initialTopic: string; voiceId?: string; quota: { used: number; limit: number }; tzLabel: string };

/** Create, Step 1 (Stitch "Create — Step 1: Idea"): default, topic typed, loading, unsafe topic, daily limit, script failed. */
export function CreateClient({ initialTopic, voiceId, quota, tzLabel }: Props) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState(initialTopic);
  const [angle, setAngle] = useState<AngleId | null>('everyday');
  const [lengthSec, setLengthSec] = useState<30 | 60 | 90>(60);
  const [audience, setAudience] = useState('Class 7');
  const [ideas, setIdeas] = useState<Idea[]>(POOL.slice(0, 6));
  const [poolAt, setPoolAt] = useState(0);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(false);
  const [used, setUsed] = useState(quota.used);
  const [banner, setBanner] = useState<Banner | null>(quota.used >= quota.limit ? { kind: 'daily' } : null);

  const limited = used >= quota.limit;
  const left = Math.max(0, quota.limit - used);
  const pct = Math.min(100, Math.round((used / Math.max(1, quota.limit)) * 100));

  function applyTopic(text: string) {
    setTopic(text.slice(0, MAX));
    setHint(false);
    if (banner?.kind === 'unsafe') setBanner(null);
    input.current?.focus();
  }

  async function suggestMore() {
    if (ideasBusy) return;
    setIdeasBusy(true);
    const res = await api<{ ideas: { topic: string; hint: string }[] }>('/api/ideas/suggest', { body: {} });
    if (res.ok && res.data.ideas.length) {
      setIdeas(res.data.ideas.slice(0, 6).map((i) => ({ label: i.topic.length > 28 ? `${i.topic.slice(0, 26)}…` : i.topic, text: i.topic })));
    } else {
      const next = (poolAt + 3) % POOL.length; // the AI is busy or rate limited: rotate the built-in ideas instead
      setPoolAt(next);
      setIdeas(Array.from({ length: 6 }, (_, k) => POOL[(next + k) % POOL.length]));
    }
    setIdeasBusy(false);
  }

  function fail(e: { code: string; message: string; details?: Record<string, unknown> }) {
    if (e.code === 'UNSAFE_TOPIC') setBanner({ kind: 'unsafe' });
    else if (e.code === 'DAILY_LIMIT') { setUsed(quota.limit); setBanner({ kind: 'daily' }); }
    else if (e.code === 'STORYBOARD_FAILED' || e.code === 'PROVIDER_UNAVAILABLE' || e.code === 'NETWORK') {
      setBanner({
        kind: 'failed', message: e.code === 'NETWORK' ? e.message : e.code === 'PROVIDER_UNAVAILABLE' ? 'The AI service is busy right now.' : 'The script did not pass our checks.',
        videoId: e.details?.videoId as string | undefined, version: e.details?.version as number | undefined,
      });
    } else setBanner({ kind: 'error', message: e.message });
  }

  async function create() {
    if (loading || limited) return;
    if (topic.trim().length < 3) { setHint(true); input.current?.focus(); return; }
    setBanner(null);
    setLoading(true);
    const res = await api<VideoView>('/api/videos', {
      body: { topic: topic.trim(), lengthSec, audience, language: 'en', ...(angle ? { angle } : {}), ...(voiceId ? { voiceId } : {}) },
    });
    if (res.ok) { router.push(`/videos/${res.data.id}/review`); return; }
    setLoading(false);
    fail(res.error);
  }

  async function retry() {
    const b = banner;
    if (b?.kind !== 'failed' || loading) return;
    if (!b.videoId || b.version === undefined) { setBanner(null); return create(); }
    setBanner(null);
    setLoading(true);
    const res = await api<VideoView>(`/api/videos/${b.videoId}/regenerate`, { body: { version: b.version } });
    if (res.ok) { router.push(`/videos/${res.data.id}/review`); return; }
    setLoading(false);
    fail({ ...res.error, details: { videoId: b.videoId, version: res.error.details?.version ?? b.version } });
  }

  return (
    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 pt-6 md:pt-9 pb-24 md:pb-20">
      <div className="max-w-[720px] mx-auto">
        <Stepper current={1} variant="dots" />

        <div className="mb-6">
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-[40px] sm:leading-[1.1] text-[#0F2A20] tracking-tight">What should the video explain?</h1>
          <p className="font-body-md text-[16px] text-[#54675D] mt-2 leading-[26px]">Describe the lesson. You can edit everything before it renders.</p>
        </div>

        {banner?.kind === 'unsafe' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">report</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium">We cannot make a video about that topic. Try a different lesson.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">The safety check flagged this topic as unsuitable for a classroom video. Reword it or pick another idea below.</p>
            </div>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}
        {banner?.kind === 'daily' && (
          <div role="status" className="mb-5 p-4 rounded-2xl bg-[#FEF8F0] border border-[#FBE0BC] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 text-[#B36B00]">timelapse</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#935500]">You have used all {quota.limit} videos today. Resets at 12:00 AM {tzLabel}.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">Daily limits keep the free rendering service available for everyone. You can still edit and download existing videos.</p>
            </div>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}
        {banner?.kind === 'failed' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error_outline</span>
            <div className="flex-1">
              <p className="text-[14px] font-medium">We could not write the script. Try again.</p>
              <p className="text-[12px] text-[#54675D] mt-0.5">{banner.message} This attempt does not use up your daily allowance.</p>
            </div>
            <button onClick={retry} className="px-3 py-1 rounded-lg bg-white border border-[#B9C5B5] text-[#0F2A20] hover:bg-[#E1E7DF] text-xs font-medium transition-colors">Try again</button>
          </div>
        )}
        {banner?.kind === 'error' && (
          <div role="alert" className="mb-5 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#C93A2E] flex items-start gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error_outline</span>
            <p className="flex-1 text-[14px] font-medium">{banner.message}</p>
            <button onClick={() => setBanner(null)} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Dismiss</button>
          </div>
        )}

        <div className="bg-white rounded-[24px] border border-[#D3DBD0] hero-atelier-shadow p-6 sm:p-8 relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="topic-input" className="font-headline-sm text-[15px] text-[#0F2A20] tracking-tight">Lesson topic or prompt</label>
              <span className={`font-code-sm text-[12px] ${topic.length >= MAX ? 'text-[#C93A2E]' : 'text-[#54675D]'}`}>{topic.length} / {MAX}</span>
            </div>
            <textarea
              ref={input} id="topic-input" rows={4} maxLength={MAX} value={topic} disabled={loading}
              onChange={(e) => { setTopic(e.target.value); setHint(false); }}
              placeholder={hint ? 'Please enter a topic first (at least 3 characters)…' : 'Why do we have seasons? Explain for class 7.'}
              className={`w-full rounded-[12px] border bg-white p-4 text-[16px] leading-[26px] text-[#0F2A20] placeholder:text-[#54675D]/60 focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10 outline-none transition-all resize-none font-body-md ${hint ? 'border-[#C93A2E]' : 'border-[#D3DBD0]'}`}
            />
          </div>

          <div className="mt-4 pt-1">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-medium text-[#54675D] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />Need an idea?</span>
              <button type="button" onClick={suggestMore} disabled={ideasBusy || loading} className="text-[13px] text-[#145A41] hover:text-[#0F4632] font-medium underline-offset-4 hover:underline rounded px-1 disabled:opacity-60">
                {ideasBusy ? 'Thinking…' : 'Suggest more'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ideas.map((i) => (
                <button
                  key={i.text} type="button" onClick={() => applyTopic(i.text)} disabled={loading}
                  className="px-3 py-1.5 rounded-full bg-[#E1E7DF]/60 hover:bg-[#E1E7DF] text-[#0F2A20] text-[13px] border border-[#D3DBD0]/80 transition-colors"
                >{i.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-[#D3DBD0]/80">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-headline-sm text-[15px] text-[#0F2A20] tracking-tight">Choose an angle</span>
                <span className="text-xs text-[#54675D] ml-2 font-code-sm">(Optional)</span>
              </div>
              <span className="text-xs text-[#54675D] hidden sm:inline">Adapts pedagogical tone</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Angle">
              {ANGLES.map((a) => {
                const on = angle === a.id;
                return (
                  <button
                    key={a.id} type="button" role="radio" aria-checked={on} disabled={loading} onClick={() => setAngle(on ? null : a.id)}
                    className={`text-left p-3.5 rounded-[16px] border relative transition-all group ${on ? 'border-[#145A41] bg-[#145A41]/5 shadow-sm' : 'border-[#D3DBD0] hover:border-[#B9C5B5] bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`material-symbols-outlined text-[20px] transition-colors ${on ? 'text-[#145A41]' : 'text-[#54675D] group-hover:text-[#145A41]'}`}>{a.icon}</span>
                      {on && <span className="w-4 h-4 rounded-full bg-[#145A41] text-white flex items-center justify-center text-[10px]">✓</span>}
                    </div>
                    <h2 className="font-headline-sm text-[14px] text-[#0F2A20] mt-2">{a.title}</h2>
                    <p className="text-[12px] text-[#54675D] mt-0.5 leading-normal">{a.text}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-[#D3DBD0]/80">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-end">
              <div className="sm:col-span-5">
                <span className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Length</span>
                <div className="flex bg-[#EEF1EC] p-1 rounded-[12px] border border-[#D3DBD0]" role="radiogroup" aria-label="Reel length">
                  {LENGTHS.map((s) => (
                    <button
                      key={s} type="button" role="radio" aria-checked={lengthSec === s} disabled={loading} onClick={() => setLengthSec(s)}
                      className={`flex-1 py-1.5 text-center text-[13px] font-code-sm rounded-[8px] transition-all ${lengthSec === s ? 'bg-white text-[#145A41] font-semibold shadow-sm border border-[#D3DBD0]/60' : 'text-[#54675D] hover:text-[#0F2A20]'}`}
                    >{s}s</button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="audience-select" className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Audience</label>
                <div className="relative">
                  <select
                    id="audience-select" value={audience} disabled={loading} onChange={(e) => setAudience(e.target.value)}
                    className="w-full appearance-none rounded-[12px] border border-[#D3DBD0] bg-white px-3.5 py-2 text-[14px] text-[#0F2A20] focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10 outline-none cursor-pointer pr-9"
                  >
                    {AUDIENCES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-[#54675D] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">expand_more</span>
                </div>
              </div>
              <div className="sm:col-span-3">
                <span className="block font-headline-sm text-[13px] text-[#0F2A20] mb-2 tracking-tight">Language</span>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] bg-[#E1E7DF]/50 border border-[#D3DBD0] text-[#0F2A20] text-[14px]">
                  <span className="material-symbols-outlined text-[16px] text-[#145A41]">translate</span>
                  <span className="font-medium">English</span>
                  <span className="text-[10px] font-code-sm text-[#54675D] uppercase ml-auto">Fixed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#D3DBD0] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="material-symbols-outlined text-[16px] text-[#145A41]">timelapse</span>
              <span className="font-code-sm text-[12px] text-[#54675D]">{left} of {quota.limit} videos left today{limited ? ' (Limit reached)' : ''}</span>
              <div className="w-8 h-1.5 bg-[#E1E7DF] rounded-full overflow-hidden" aria-hidden>
                <div className="h-full bg-gradient-to-r from-[#145A41] to-[#FF9F1C] rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="w-full sm:w-auto flex flex-col items-end">
              {!loading ? (
                <button
                  type="button" onClick={create} disabled={limited}
                  className={`btn-lift w-full sm:w-auto px-6 py-3.5 rounded-[12px] text-white font-semibold text-[15px] tracking-tight shadow-sm flex items-center justify-center gap-2.5 ${limited ? 'bg-[#145A41] opacity-50 cursor-not-allowed' : 'bg-[#145A41] hover:bg-[#0F4632]'}`}
                >
                  <span>Create script and storyboard</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ) : (
                <div className="w-full sm:w-[320px] flex flex-col items-end gap-1.5" role="status" aria-live="polite">
                  <button disabled className="w-full px-6 py-3.5 rounded-[12px] bg-[#145A41]/90 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 cursor-wait">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Writing your script...</span>
                  </button>
                  <div className="w-full h-1 bg-[#D3DBD0] rounded-full overflow-hidden relative mt-1">
                    <div className="h-full w-1/2 bg-gradient-to-r from-[#145A41] to-[#FF9F1C] rounded-full animate-indeterminate" />
                  </div>
                  <span className="text-[12px] font-code-sm text-[#54675D]">This takes about 30 seconds</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between text-[12px] font-code-sm text-[#54675D] px-2">
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" /><span>The AI drafts it, you review every scene</span></div>
          <div className="mt-2 sm:mt-0">Target: 1080×1920 9:16 Vertical</div>
        </div>
      </div>
    </main>
  );
}
