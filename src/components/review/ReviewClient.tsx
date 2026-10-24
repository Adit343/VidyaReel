'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiError } from '@/lib/client-api';
import { clock } from '@/lib/time';
import type { VideoView } from '@/server/videos/view';
import { Stepper } from '../create/Stepper';
import { useToast } from '../shell/Toast';
import { SceneCard } from './SceneCard';
import { SettingsPanel, type Settings } from './SettingsPanel';

type SaveState = 'saved' | 'saving' | 'conflict' | 'error';
type Pending = Partial<Settings> & { title?: string };

const settingsOf = (v: VideoView): Settings => ({ voiceId: v.voiceId, speed: v.speed, theme: v.theme, captionsOn: v.captionsOn });

/** Review, Step 2 (Stitch "Create — Step 2: Review Script & Storyboard"): all seven reviewer states plus the inline menus. */
export function ReviewClient({ initial }: { initial: VideoView }) {
  const router = useRouter();
  const toast = useToast();
  const [video, setVideo] = useState(initial);
  const [settings, setSettings] = useState(settingsOf(initial));
  const [title, setTitle] = useState(initial.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [save, setSave] = useState<SaveState>('saved');
  const [saveNote, setSaveNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [wholeBusy, setWholeBusy] = useState(false);
  const [confirmWhole, setConfirmWhole] = useState(false);
  const [reloading, setReloading] = useState(false);

  const version = useRef(initial.version);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<Pending>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abort = useRef<AbortController | null>(null);

  const locked = video.status === 'rendering';
  const hasScenes = video.scenes.length > 0;
  const noStoryboard = !hasScenes;
  const busy = wholeBusy || reloading;

  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.current.then(fn, fn);
    chain.current = run.catch(() => undefined);
    return run;
  }, []);

  const fail = useCallback((e: ApiError) => {
    if (e.code === 'VERSION_CONFLICT') { setSave('conflict'); setSaveNote(''); return; }
    if (e.code === 'VIDEO_LOCKED') { setSave('conflict'); setSaveNote('Video is rendering'); return; }
    setSave('error');
    setSaveNote(e.message);
  }, []);

  /** Takes the scenes and numbers from a server answer; settings stay as the member has them on screen. */
  const adopt = useCallback((v: VideoView) => {
    version.current = v.version;
    setVideo((cur) => ({ ...cur, version: v.version, scenes: v.scenes, estimatedSec: v.estimatedSec, warnings: v.warnings, status: v.status, failureReason: v.failureReason }));
  }, []);

  /** One saved change: queued so versions never race; the pill shows Saving / Saved / Conflict. */
  const send = useCallback((path: string, method: string, body: (version: number) => unknown, optimistic?: () => void) => {
    optimistic?.();
    setSave('saving');
    return enqueue(async () => {
      const url = method === 'DELETE' ? `${path}?version=${version.current}` : path;
      const res = await api<VideoView>(url, { method, body: method === 'DELETE' ? undefined : body(version.current) });
      if (res.ok) { adopt(res.data); setSave((s) => (timer.current || Object.keys(pending.current).length ? s : 'saved')); }
      else {
        fail(res.error);
        // A rejected edit must not stay on screen as if it were saved: show the server's copy again.
        if (optimistic && res.error.code !== 'VERSION_CONFLICT' && res.error.code !== 'VIDEO_LOCKED') {
          const fresh = await api<VideoView>(`/api/videos/${video.id}`);
          if (fresh.ok) adopt(fresh.data);
          toast('error', res.error.message);
        }
      }
      return res;
    });
  }, [adopt, enqueue, fail, toast, video.id]);

  const flushSettings = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    await send(`/api/videos/${video.id}`, 'PATCH', (v) => ({ version: v, ...patch }));
  }, [send, video.id]);

  const queueSettings = useCallback((patch: Pending) => {
    pending.current = { ...pending.current, ...patch };
    setSave('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flushSettings, 800);
  }, [flushSettings]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (patch: Partial<Settings>) => { setSettings((s) => ({ ...s, ...patch })); queueSettings(patch); };

  function commitTitle(next: string) {
    setEditingTitle(false);
    const t = next.trim();
    if (!t) { setTitle(video.title); return; }
    setTitle(t);
    if (t !== video.title) { setVideo((v) => ({ ...v, title: t })); queueSettings({ title: t }); }
  }

  async function reload() {
    setReloading(true);
    clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = {};
    const res = await api<VideoView>(`/api/videos/${video.id}`);
    if (res.ok) {
      version.current = res.data.version;
      setVideo(res.data); setSettings(settingsOf(res.data)); setTitle(res.data.title);
      setEditingId(null); setRegenId(null); setDeleteId(null); setSave('saved'); setSaveNote('');
    } else toast('error', res.error.message);
    setReloading(false);
  }

  /* ---- scene actions ---- */
  const base = `/api/videos/${video.id}/scenes`;
  const idx = (id: string) => video.scenes.findIndex((s) => s.id === id);

  function saveScene(id: string, v: { narration: string; text: string }) {
    setEditingId(null);
    const scene = video.scenes[idx(id)];
    const rest = scene.onScreenText.slice(1);
    const onScreenText = v.text ? [v.text, ...rest] : rest;
    void send(`${base}/${id}`, 'PATCH', (ver) => ({ version: ver, narration: v.narration, onScreenText }), () =>
      setVideo((cur) => ({ ...cur, scenes: cur.scenes.map((s) => (s.id === id ? { ...s, narration: v.narration, onScreenText } : s)) })));
  }

  function move(id: string, by: -1 | 1) {
    const from = idx(id);
    const to = from + by;
    if (to < 0 || to >= video.scenes.length) return;
    void send(`${base}/${id}`, 'PATCH', (ver) => ({ version: ver, moveTo: to }), () =>
      setVideo((cur) => {
        const list = [...cur.scenes];
        const [m] = list.splice(from, 1);
        list.splice(to, 0, m);
        return { ...cur, scenes: list.map((s, order) => ({ ...s, order })) };
      }));
  }

  function remove(id: string) {
    setDeleteId(null);
    void send(`${base}/${id}`, 'DELETE', () => undefined, () =>
      setVideo((cur) => ({ ...cur, scenes: cur.scenes.filter((s) => s.id !== id).map((s, order) => ({ ...s, order })) })));
  }

  async function addBlank(afterSceneId?: string) {
    const res = await send(base, 'POST', (ver) => ({ version: ver, afterSceneId }));
    if (res.ok) {
      const added = res.data.scenes.find((s) => !video.scenes.some((o) => o.id === s.id));
      if (added) { setEditingId(added.id); setTimeout(() => document.getElementById(`scene-${added.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
    }
  }

  function regenerate(id: string) {
    const ctl = new AbortController();
    abort.current = ctl;
    setRegenId(id);
    setSave('saving');
    void enqueue(async () => {
      if (ctl.signal.aborted) return;
      const res = await api<VideoView>(`${base}/${id}/regenerate`, { body: { version: version.current }, signal: ctl.signal });
      if (res.ok) { adopt(res.data); setSave('saved'); toast('success', 'Scene rewritten.'); }
      else if (res.error.code !== 'ABORTED') { fail(res.error); toast('error', res.error.code === 'STORYBOARD_FAILED' ? 'We could not rewrite that scene. Try again.' : res.error.message); }
      else setSave('saved');
      setRegenId((cur) => (cur === id ? null : cur));
    });
  }

  function cancelRegenerate() {
    abort.current?.abort();
    setRegenId(null);
    setSave('saved');
  }

  async function regenerateAll() {
    setConfirmWhole(false);
    setWholeBusy(true);
    setEditingId(null);
    await flushSettings();
    const res = await enqueue(() => api<VideoView>(`/api/videos/${video.id}/regenerate`, { body: { version: version.current } }));
    if (res.ok) {
      version.current = res.data.version;
      setVideo(res.data); setTitle(res.data.title); setSave('saved');
      toast('success', 'New script written.');
    } else {
      fail(res.error);
      toast('error', res.error.code === 'DAILY_LIMIT' ? res.error.message : res.error.code === 'VERSION_CONFLICT' ? 'This video changed elsewhere. Reload to see the latest.' : 'We could not write the script. Try again.');
    }
    setWholeBusy(false);
  }

  async function generate() {
    await flushSettings();
    await chain.current;
    router.push(`/videos/${video.id}/generate`);
  }

  const words = video.scenes.reduce((n, s) => n + s.words, 0);
  const over = video.estimatedSec > video.lengthSec;
  const longest = [...video.scenes].sort((a, b) => b.estimatedSec - a.estimatedSec).slice(0, 2).map((s) => s.order + 1).sort((a, b) => a - b);
  const warning = video.warnings[0] ?? null;
  const dirtyEditing = editingId !== null;

  const pill = {
    saved: { cls: 'border-[#D3DBD0] text-[#54675D] hover:border-[#0F4632]', dot: 'bg-[#1A8F5A]', text: '• Saved' },
    saving: { cls: 'border-[#FF9F1C] text-[#B36B00]', dot: 'bg-[#FF9F1C] animate-spin', text: 'Saving...' },
    conflict: { cls: 'border-[#C93A2E] bg-[#FFF5F5] text-[#C93A2E]', dot: 'bg-[#C93A2E]', text: saveNote || 'Conflict: reload to see latest' },
    error: { cls: 'border-[#C93A2E] bg-[#FFF5F5] text-[#C93A2E]', dot: 'bg-[#C93A2E]', text: saveNote ? `Not saved: ${saveNote}` : 'Not saved' },
  }[save];

  return (
    <div className="pb-44 md:pb-32">
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-6 pb-2"><Stepper current={2} variant="line" /></section>

      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap min-w-0">
            <Link href="/create" className="inline-flex items-center gap-1.5 text-body-sm font-ui-medium text-[#54675D] hover:text-[#145A41] transition-colors">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span><span>Step 1: Idea</span>
            </Link>
            <div className="h-4 w-px bg-[#D3DBD0] hidden sm:block" />
            <div className="flex items-center gap-2 group min-w-0">
              {editingTitle ? (
                <input
                  autoFocus defaultValue={title} maxLength={100} aria-label="Video title"
                  onBlur={(e) => commitTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(e.currentTarget.value); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="font-headline-md text-[24px] md:text-[28px] text-[#0F2A20] font-bold tracking-tight bg-white border border-[#145A41] rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-[#145A41]/20 min-w-0"
                />
              ) : (
                <>
                  <h1 className="font-headline-md text-[24px] md:text-[28px] lg:text-[32px] text-[#0F2A20] font-bold tracking-tight truncate leading-[1.3] py-0.5" id="lesson-title">{title}</h1>
                  <button aria-label="Edit title" disabled={locked} onClick={() => setEditingTitle(true)} className="p-1 rounded text-[#54675D] hover:text-[#145A41] hover:bg-white/80 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </>
              )}
            </div>
            <button
              type="button" onClick={save === 'conflict' || save === 'error' ? reload : undefined} aria-live="polite"
              title={save === 'conflict' ? 'Reload the latest version' : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border font-code-sm text-[11px] transition-colors ${pill.cls} ${save === 'conflict' || save === 'error' ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`w-2 h-2 rounded-full ${pill.dot}`} />
              <span>{pill.text}</span>
              {(save === 'conflict' || save === 'error') && <span className="underline ml-1">Reload</span>}
            </button>
          </div>
          <div className={`px-3 py-1.5 rounded-full border font-code-sm text-[11px] flex items-center gap-1.5 self-start sm:self-auto ${over ? 'bg-[#FFF5F5] border-[#C93A2E]/40 text-[#C93A2E]' : 'bg-[#E1E7DF] border-[#D3DBD0] text-[#0F2A20]'}`}>
            <span className={`material-symbols-outlined text-[15px] ${over ? 'text-[#C93A2E]' : 'text-[#145A41]'}`}>timer</span>
            <span>{clock(video.estimatedSec)} {over ? '(Exceeds limit)' : 'estimated'}</span>
          </div>
        </div>
      </section>

      <main className="max-w-[1120px] mx-auto px-4 sm:px-6">
        {locked && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-[#FFF8EB] border border-[#FFDCBC] text-[#744400] text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>This video is being rendered, so the storyboard is locked until it finishes.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <h2 className="font-headline-sm text-[#0F2A20]">Storyboard scenes ({video.scenes.length})</h2>
                <p className="text-body-sm text-[#54675D] mt-0.5">Click any narration to refine it before rendering.</p>
              </div>
            </div>

            {wholeBusy ? (
              <div className="flex flex-col gap-4" aria-busy="true" aria-label="Writing a new script">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="bg-white rounded-2xl border border-[#D3DBD0] p-5 space-y-4">
                    <div className="h-4 w-32 rounded shimmer-sage" />
                    <div className="flex gap-4">
                      <div className="w-[90px] h-[160px] rounded-xl shimmer-sage shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-4 w-full rounded shimmer-sage" /><div className="h-4 w-4/5 rounded shimmer-sage" /><div className="h-4 w-3/4 rounded shimmer-sage" />
                        <div className="h-8 w-48 rounded-full shimmer-sage mt-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : noStoryboard ? (
              <div className="bg-white rounded-2xl border border-[#D3DBD0] p-8 sm:p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E1E7DF] flex items-center justify-center mx-auto mb-4 text-[#54675D]">
                  <span className="material-symbols-outlined text-[32px]">{video.status === 'failed' ? 'error_outline' : 'movie_edit'}</span>
                </div>
                <h3 className="font-headline-sm text-[#0F2A20] mb-1">{video.status === 'failed' ? 'We could not write the script' : 'No scenes drafted yet'}</h3>
                <p className="text-body-sm text-[#54675D] max-w-sm mx-auto mb-6">
                  {video.status === 'failed'
                    ? 'The script did not pass our checks. This attempt does not use up your daily allowance. Try again, or add scenes yourself.'
                    : 'Start by generating your storyboard scenes from your lesson concept or manually add individual beats.'}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button onClick={regenerateAll} disabled={busy || locked} className="px-5 py-2.5 rounded-xl bg-[#145A41] text-white font-ui-medium text-body-sm hover:bg-[#0F4632] shadow-sm disabled:opacity-60">
                    {video.status === 'failed' ? 'Try again' : 'Generate from prompt'}
                  </button>
                  <button onClick={() => addBlank()} disabled={busy || locked} className="px-4 py-2.5 rounded-xl bg-white border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-body-sm hover:bg-[#E1E7DF] disabled:opacity-60">+ Blank scene</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4" id="scenes-container">
                {video.scenes.map((scene, i) => (
                  <SceneCard
                    key={scene.id} scene={scene} index={i} count={video.scenes.length} busy={locked || busy}
                    editing={editingId === scene.id} regenerating={regenId === scene.id} confirmingDelete={deleteId === scene.id}
                    actions={{
                      edit: () => { setDeleteId(null); setEditingId(scene.id); },
                      regenerate: () => regenerate(scene.id),
                      moveUp: () => move(scene.id, -1), moveDown: () => move(scene.id, 1),
                      askDelete: () => { setEditingId(null); setDeleteId(scene.id); },
                    }}
                    onSave={(v) => saveScene(scene.id, v)}
                    onCancelEdit={() => setEditingId(null)} onCancelRegenerate={cancelRegenerate}
                    onConfirmDelete={() => remove(scene.id)} onCancelDelete={() => setDeleteId(null)}
                  />
                ))}
              </div>
            )}

            {hasScenes && !wholeBusy && (
              <div className="pt-2">
                <button
                  onClick={() => addBlank(video.scenes[video.scenes.length - 1].id)} disabled={locked || busy || video.scenes.length >= 12}
                  className="w-full py-3.5 rounded-2xl border border-dashed border-[#B9C5B5] bg-white/60 hover:bg-white text-[#54675D] hover:text-[#145A41] font-ui-medium text-body-sm flex items-center justify-center gap-2 transition-all duration-150 group shadow-sm disabled:opacity-50"
                >
                  <span className="w-5 h-5 rounded-full bg-[#E1E7DF] group-hover:bg-[#145A41] group-hover:text-white flex items-center justify-center text-[#145A41] transition-colors">
                    <span className="material-symbols-outlined text-[14px]">add</span>
                  </span>
                  <span>{video.scenes.length >= 12 ? 'Scene limit reached (12)' : 'Add new scene beat'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <SettingsPanel settings={settings} onChange={change} disabled={locked || busy} estimatedSec={video.estimatedSec} lengthSec={video.lengthSec} warning={warning} longest={longest} />
            <div className="bg-white/70 rounded-2xl border border-[#D3DBD0] p-4 text-body-sm text-[#54675D]">
              <div className="flex items-center gap-2 mb-1.5 text-[#145A41] font-semibold">
                <span className="material-symbols-outlined text-[16px]">psychology</span><span>Teaching tip</span>
              </div>
              <p className="text-[12px] leading-relaxed">Open with the question or the misconception students usually have. The first few seconds decide whether they keep watching.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-40 bg-[#EEF1EC]/95 backdrop-blur-md border-t border-[#D3DBD0] py-3 md:py-3.5 px-4 sm:px-6 overlay-ambient-shadow">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between flex-wrap gap-3">
          {confirmWhole ? (
            <div role="alertdialog" className="flex items-center gap-2 flex-wrap text-body-sm animate-fade-in">
              <span className="text-[#0F2A20] font-ui-medium">Replace every scene with a new script? Your edits will be lost.</span>
              <button onClick={regenerateAll} className="px-3 py-1 rounded-lg bg-[#145A41] text-white font-ui-medium text-code-sm hover:bg-[#0F4632]">Yes, regenerate</button>
              <button onClick={() => setConfirmWhole(false)} className="px-3 py-1 rounded-lg bg-white border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-code-sm hover:bg-[#E1E7DF]">Keep mine</button>
            </div>
          ) : (
            <button
              onClick={() => (hasScenes ? setConfirmWhole(true) : regenerateAll())} disabled={locked || busy || save === 'conflict'}
              className="inline-flex items-center gap-1.5 text-[#54675D] hover:text-[#0F2A20] font-ui-medium text-body-sm transition-colors group disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-300">sync</span>
              <span>Regenerate whole script</span>
            </button>
          )}
          <div className="flex items-center gap-4 sm:gap-6 ml-auto">
            <div className="hidden sm:flex items-center gap-2 font-code-sm text-[11px] text-[#54675D]">
              <span className={`w-2 h-2 rounded-full ${video.scenes.length ? 'bg-[#1A8F5A]' : 'bg-[#B9C5B5]'}`} />
              <span>{video.scenes.length} scenes · {words} words</span>
            </div>
            <button
              onClick={generate} disabled={!hasScenes || busy || locked || save === 'conflict' || dirtyEditing || regenId !== null}
              title={dirtyEditing ? 'Save or cancel your edit first' : save === 'conflict' ? 'Reload the latest version first' : undefined}
              className="px-5 sm:px-6 py-3 rounded-xl bg-[#145A41] text-white font-ui-medium text-body-md hover:bg-[#0F4632] active:scale-[0.99] transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#145A41] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Looks good, generate video</span><span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
