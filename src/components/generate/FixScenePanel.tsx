'use client';
import { useState } from 'react';
import { api, type ApiError } from '@/lib/client-api';
import type { VideoView } from '@/server/videos/view';
import { Select } from '../ui/Select';

/**
 * "Fix a specific scene beat" (Stitch Step 3, Ready state). The new words are saved on the scene, then the render
 * starts for that scene only: its voice is re-recorded, the other scenes keep theirs, and the whole video is put
 * together again (Remotion renders one timeline). A fix does not use another slot of the daily limit.
 */
export function FixScenePanel({ video, startError, onClose, onRerender, onVideo }: {
  video: VideoView; startError: ApiError | null; onClose: () => void;
  onRerender: (version: number, sceneIds: string[]) => Promise<boolean>; onVideo: (v: VideoView) => void;
}) {
  const [sceneId, setSceneId] = useState(video.scenes[0]?.id ?? '');
  const scene = video.scenes.find((s) => s.id === sceneId);
  const [text, setText] = useState(scene?.narration ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = !!scene && text.trim() !== scene.narration && text.trim().length > 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function pick(id: string) {
    setSceneId(id);
    setText(video.scenes.find((s) => s.id === id)?.narration ?? '');
    setError(null);
  }

  async function submit() {
    if (!scene || !changed) return;
    setBusy(true);
    setError(null);
    const saved = await api<VideoView>(`/api/videos/${video.id}/scenes/${scene.id}`, { method: 'PATCH', body: { version: video.version, narration: text.trim() } });
    if (!saved.ok) { setError(saved.error.message); setBusy(false); return; }
    onVideo(saved.data);
    const ok = await onRerender(saved.data.version, [scene.id]);
    if (!ok) setError('We could not start the update. Your new words are saved; try again.');
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-[24px] border-2 border-[#145A41]/30 p-6 shadow-[0_4px_20px_-2px_rgba(20,90,65,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#145A41] text-white flex items-center justify-center"><span className="material-symbols-outlined text-[14px]">edit</span></div>
          <h3 className="font-headline-sm text-lg text-[#0F2A20] font-bold">Fix a specific scene beat</h3>
        </div>
        <button type="button" onClick={onClose} className="text-[#54675D] hover:text-[#0F2A20] text-xs font-code-sm">Close</button>
      </div>

      <p className="text-xs text-[#54675D] mb-4 leading-relaxed">
        Only this scene&apos;s narration is recorded again; the other scenes keep their voice. The video is then put together again, which takes a few minutes. It does not use up another video of your daily limit.
      </p>

      <div className="mb-4">
        <label htmlFor="fix-scene" className="block text-xs font-code-sm uppercase text-[#54675D] mb-1.5">Select scene to tweak</label>
        <Select
          id="fix-scene" value={sceneId} onChange={pick} disabled={busy}
          options={video.scenes.map((s) => ({
            value: s.id,
            label: `Scene ${s.order + 1}${s.durationMs ? ` · ${Math.round(s.durationMs / 1000)}s` : ''}`,
            hint: s.title ?? s.narration.slice(0, 50),
          }))}
        />
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="fix-narration" className="text-xs font-code-sm uppercase text-[#54675D]">Narration voiceover</label>
          <span className="text-[11px] font-code-sm text-[#54675D]">{text.length} chars · about {Math.max(1, Math.round(words / 2.3))} sec</span>
        </div>
        <textarea
          id="fix-narration" rows={3} value={text} maxLength={600} disabled={busy} onChange={(e) => setText(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#EEF1EC] border border-[#D3DBD0] text-sm text-[#0F2A20] leading-relaxed outline-none focus:border-[#145A41] focus:ring-[3px] focus:ring-[#145A41]/12 disabled:opacity-60"
        />
      </div>

      {(error || startError) && <p role="alert" className="mb-3 text-[13px] text-[#C93A2E]">{error ?? startError?.message}</p>}

      <div className="flex items-center justify-between pt-2 border-t border-[#D3DBD0]/80">
        <button type="button" onClick={onClose} disabled={busy} className="px-3 py-2 rounded-xl text-xs font-medium text-[#54675D] hover:text-[#0F2A20]">Cancel</button>
        <button
          type="button" onClick={submit} disabled={busy || !changed}
          className="btn-lift px-4 py-2 rounded-xl bg-[#145A41] hover:bg-[#0F4632] text-white text-xs font-semibold font-headline-sm flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span><span>{busy ? 'Starting…' : 'Re-render with this change'}</span>
        </button>
      </div>
    </div>
  );
}
