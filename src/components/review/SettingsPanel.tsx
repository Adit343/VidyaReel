'use client';
import { useEffect, useRef, useState } from 'react';
import { VOICES } from '@/config/voices';
import { Select } from '@/components/ui/Select';
import { clock } from '@/lib/time';

export type Settings = {
  voiceId: string; speed: number; theme: string; captionsOn: boolean;
  musicId: string | null; musicVolume: number;
};

const THEMES = [
  { id: 'forest', label: 'Forest', swatch: 'bg-[#145A41]' },
  { id: 'saffron', label: 'Saffron', swatch: 'bg-[#FF9F1C]' },
  { id: 'sage', label: 'Sage Dark', swatch: 'bg-[#0F2A20]' },
  { id: 'chalkboard', label: 'Chalkboard', swatch: 'bg-[#2F4F43]' },
  { id: 'blackboard', label: 'Blackboard', swatch: 'bg-[#1E1F21]' },
  { id: 'slate', label: 'Slate Blue', swatch: 'bg-[#1F2F46]' },
  { id: 'rose', label: 'Rose Paper', swatch: 'bg-[#B3305A]' },
  { id: 'ocean', label: 'Ocean', swatch: 'bg-[#0E6E95]' },
] as const;

type Props = {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; disabled: boolean;
  estimatedSec: number; lengthSec: number; warning: string | null; longest: number[];
};

type SampleState = { id: string; phase: 'loading' | 'playing' } | null;

/** One preview at a time (a voice sample or a music track): starting another stops the first. A preview that cannot load marks its button unavailable. */
function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<SampleState>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const stop = () => { audio.current?.pause(); audio.current = null; setState(null); };
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = (id: string, url: string) => {
    if (state?.id === id) return stop();
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    setState({ id, phase: 'loading' });
    const fail = () => { if (audio.current === a) { stop(); setFailed((f) => [...f, id]); } };
    a.onplaying = () => setState({ id, phase: 'playing' });
    a.onended = () => { if (audio.current === a) stop(); };
    a.onerror = fail;
    a.play().catch(fail);
  };
  return { state, failed, toggle, stop };
}

/** Right-hand "Reel settings" panel of Stitch Review: voice, pacing, theme, music, captions, duration meter. */
export function SettingsPanel({ settings: s, onChange, disabled, estimatedSec, lengthSec, warning, longest }: Props) {
  const samples = usePreview();
  const [tracks, setTracks] = useState<{ id: string; name: string; blurb: string; previewUrl: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/music').then((r) => (r.ok ? r.json() : { tracks: [] })).then((b) => { if (live) setTracks(b.tracks ?? []); }, () => { if (live) setTracks([]); });
    return () => { live = false; };
  }, []);
  const track = tracks?.find((t) => t.id === s.musicId);
  const over = estimatedSec > lengthSec;
  const pct = Math.min(100, Math.round((estimatedSec / Math.max(1, lengthSec)) * 100));
  return (
    <aside className="bg-white rounded-3xl border border-[#D3DBD0] p-6 shadow-sm" aria-label="Reel settings">
      <div className="flex items-center justify-between pb-4 border-b border-[#EEF1EC] mb-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#145A41] text-[20px]">tune</span>
          <h3 className="font-headline-sm text-[#0F2A20]">Reel settings</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-[#E1E7DF] text-[#145A41] font-code-sm text-[10px] font-semibold">1080×1920</span>
      </div>

      <fieldset className="mb-5" disabled={disabled}>
        <legend className="block font-ui-medium text-body-sm text-[#0F2A20] mb-2.5 font-semibold">Educator Narration Voice</legend>
        <div className="space-y-2" role="radiogroup">
          {VOICES.map((v) => {
            const on = s.voiceId === v.id;
            return (
              <div
                key={v.id} role="radio" aria-checked={on} tabIndex={0}
                onClick={() => onChange({ voiceId: v.id })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ voiceId: v.id }); } }}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${on ? 'border-2 border-[#145A41] bg-[#D6F5E5]/30' : 'border border-[#D3DBD0] hover:border-[#B9C5B5] hover:bg-[#EEF1EC]/40'}`}
              >
                <div className="flex items-center gap-2.5">
                  <button
                    type="button" onClick={(e) => { e.stopPropagation(); samples.toggle(v.id, `/api/voices/${v.id}/sample`); }}
                    disabled={samples.failed.includes(v.id)}
                    title={samples.failed.includes(v.id) ? 'Sample unavailable right now' : 'Preview voice sample'}
                    aria-label={`${samples.state?.id === v.id ? 'Stop' : 'Preview'} ${v.name}${samples.failed.includes(v.id) ? ' (unavailable)' : ''}`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${on || samples.state?.id === v.id ? 'bg-[#145A41] text-white hover:bg-[#0F4632]' : 'bg-[#E1E7DF] text-[#145A41] hover:bg-[#145A41] hover:text-white'}`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${samples.state?.id === v.id ? '' : 'ml-0.5'} ${samples.state?.id === v.id && samples.state.phase === 'loading' ? 'animate-spin' : ''}`}>
                      {samples.state?.id === v.id ? (samples.state.phase === 'loading' ? 'progress_activity' : 'pause') : samples.failed.includes(v.id) ? 'volume_off' : 'play_arrow'}
                    </span>
                  </button>
                  <div>
                    <span className={`font-ui-medium text-body-sm text-[#0F2A20] ${on ? 'font-semibold' : ''}`}>{v.name}</span>
                    <p className="text-[11px] text-[#54675D]">{v.blurb}</p>
                  </div>
                </div>
                {on ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-code-sm text-[10px] text-[#145A41] font-bold px-1.5 py-0.5 rounded bg-[#ADF1D0]">Selected</span>
                    <div className="w-4 h-4 rounded-full bg-[#145A41] flex items-center justify-center text-white"><span className="material-symbols-outlined text-[10px] font-bold">check</span></div>
                  </div>
                ) : <div className="w-4 h-4 rounded-full border border-[#B9C5B5]" />}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#54675D] mt-2">Changing the voice or pace re-records the narration when you generate.</p>
      </fieldset>

      <div className="mb-5 pb-5 border-b border-[#EEF1EC]">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="pace" className="font-ui-medium text-body-sm text-[#0F2A20] font-semibold">Pacing / Speed</label>
          <span className="font-code-sm text-[11px] text-[#145A41] font-bold bg-[#E1E7DF] px-2 py-0.5 rounded">{s.speed.toFixed(2)}x</span>
        </div>
        <input
          id="pace" type="range" min={0.9} max={1.1} step={0.05} value={s.speed} disabled={disabled}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
          className="w-full h-1.5 bg-[#E1E7DF] rounded-lg appearance-none cursor-pointer accent-[#145A41]"
        />
        <div className="flex justify-between text-[11px] font-code-sm text-[#54675D] mt-1.5 px-0.5">
          <span>0.9x (Deliberate)</span><span>1.0x</span><span>1.1x (Brisk)</span>
        </div>
      </div>

      <fieldset className="mb-5 pb-5 border-b border-[#EEF1EC]" disabled={disabled}>
        <legend className="block font-ui-medium text-body-sm text-[#0F2A20] mb-2.5 font-semibold">Visual Chalk Theme</legend>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup">
          {THEMES.map((t) => {
            const on = s.theme === t.id;
            return (
              <button
                key={t.id} type="button" role="radio" aria-checked={on} onClick={() => onChange({ theme: t.id })}
                className={`p-2 rounded-xl flex flex-col items-center gap-1.5 transition-colors ${on ? 'border-2 border-[#145A41] bg-[#D6F5E5]/20' : 'border border-[#D3DBD0] hover:border-[#B9C5B5]'}`}
              >
                <div className={`w-full h-7 rounded-lg ${t.swatch} flex items-center justify-center shadow-sm`}>
                  {on && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                </div>
                <span className={`text-[11px] font-ui-medium text-[#0F2A20] ${on ? 'font-semibold' : ''}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-5 pb-5 border-b border-[#EEF1EC]">
        <label htmlFor="music" className="block font-ui-medium text-body-sm text-[#0F2A20] mb-2 font-semibold">Background music</label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                id="music" ariaLabel="Background music" value={track ? track.id : ''} disabled={disabled || !tracks?.length}
                options={[{ value: '', label: 'No background music' }, ...(tracks ?? []).map((t) => ({ value: t.id, label: t.name, hint: t.blurb }))]}
                onChange={(v) => { samples.stop(); onChange({ musicId: v || null }); }}
              />
            </div>
            <button
              type="button" disabled={!track || samples.failed.includes(track.id)}
              onClick={() => track && samples.toggle(track.id, track.previewUrl)}
              title={track && samples.failed.includes(track.id) ? 'Preview unavailable right now' : 'Preview track'}
              aria-label={track ? `${samples.state?.id === track.id ? 'Stop' : 'Preview'} ${track.name}` : 'Preview track (pick a track first)'}
              className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${track && samples.state?.id === track.id ? 'bg-[#145A41] text-white' : 'bg-[#E1E7DF] text-[#145A41] hover:bg-[#145A41] hover:text-white'}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${track && samples.state?.id === track.id && samples.state.phase === 'loading' ? 'animate-spin' : ''}`}>
                {track && samples.state?.id === track.id ? (samples.state.phase === 'loading' ? 'progress_activity' : 'pause') : 'music_note'}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1 px-1">
            <span className="material-symbols-outlined text-[#54675D] text-[16px]">{s.musicVolume === 0 ? 'volume_off' : 'volume_down'}</span>
            <input
              type="range" min={0} max={100} step={5} value={s.musicVolume} disabled={disabled || !track} aria-label="Music volume while the narrator speaks"
              onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
              className="w-full h-1 bg-[#E1E7DF] rounded-lg appearance-none cursor-pointer accent-[#145A41] disabled:opacity-50"
            />
            <span className="font-code-sm text-[10px] text-[#54675D] w-8 text-right">{s.musicVolume}%</span>
          </div>
        </div>
        <p className="text-[11px] text-[#54675D] mt-1.5">
          {tracks && !tracks.length ? 'No music tracks are set up yet.' : 'The music dips under the narration and rises in the pauses. The volume is its level while the narrator speaks.'}
        </p>
      </div>

      <div className="mb-5 pb-5 border-b border-[#EEF1EC] flex items-center justify-between gap-3">
        <div>
          <span className="block font-ui-medium text-body-sm text-[#0F2A20] font-semibold">Word-by-word captions</span>
          <span className="text-[12px] text-[#54675D]">High retention animated captions</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" className="sr-only peer" checked={s.captionsOn} disabled={disabled} aria-label="Word-by-word captions" onChange={(e) => onChange({ captionsOn: e.target.checked })} />
          <div className="w-11 h-6 bg-[#D3DBD0] rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-[#145A41] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#145A41]" />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-ui-medium text-body-sm text-[#0F2A20] font-semibold">Total Duration Target</span>
          <span className={`font-code-sm text-[11px] font-bold ${over ? 'text-[#C93A2E]' : 'text-[#145A41]'}`}>{clock(estimatedSec)} / {clock(lengthSec)} max</span>
        </div>
        <div className="w-full h-2 bg-[#E1E7DF] rounded-full overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={lengthSec} aria-valuenow={estimatedSec} aria-label="Estimated duration">
          <div className={`h-full rounded-full transition-all duration-300 ${over ? 'bg-[#C93A2E]' : 'bg-gradient-to-r from-[#145A41] to-[#1A8F5A]'}`} style={{ width: `${pct}%` }} />
        </div>
        {warning && (
          <div role="status" className="mt-3 p-3 rounded-xl bg-[#FFDCBC]/40 border border-[#FF9F1C] text-[#0F2A20] text-body-sm flex items-start gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[#B36B00] text-[18px] shrink-0 mt-0.5">alarm</span>
            <div>
              <p className="font-semibold text-[#543000] text-[12px]">Pacing Warning · {clock(estimatedSec)} Duration</p>
              <p className="text-[11px] text-[#54675D] mt-0.5 leading-snug">
                {warning}. Shorten {longest.length ? `Scene ${longest.join(' or ')}` : 'a scene'} to fit the {lengthSec}s reel.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
