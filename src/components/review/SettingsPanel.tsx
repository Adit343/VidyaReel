'use client';
import { VOICES } from '@/config/voices';
import { clock } from '@/lib/time';

export type Settings = { voiceId: string; speed: number; theme: string; captionsOn: boolean };

const THEMES = [
  { id: 'forest', label: 'Forest', swatch: 'bg-[#145A41]' },
  { id: 'saffron', label: 'Saffron', swatch: 'bg-[#FF9F1C]' },
  { id: 'sage', label: 'Sage Dark', swatch: 'bg-[#0F2A20]' },
] as const;

type Props = {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; disabled: boolean;
  estimatedSec: number; lengthSec: number; warning: string | null; longest: number[];
};

/** Right-hand "Reel settings" panel of Stitch Review: voice, pacing, theme, music, captions, duration meter. */
export function SettingsPanel({ settings: s, onChange, disabled, estimatedSec, lengthSec, warning, longest }: Props) {
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
                    type="button" disabled title="Voice samples arrive with the voice step" aria-label={`Preview ${v.name} (not available yet)`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 opacity-60 cursor-not-allowed ${on ? 'bg-[#145A41] text-white' : 'bg-[#E1E7DF] text-[#145A41]'}`}
                  ><span className="material-symbols-outlined text-[16px] ml-0.5">play_arrow</span></button>
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
        <p className="text-[11px] text-[#54675D] mt-2">Voice samples arrive soon. Changing the voice or pace re-records the narration when you generate.</p>
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
        <div className="flex items-center gap-2">
          <select id="music" disabled className="flex-1 rounded-xl border border-[#D3DBD0] text-body-sm text-[#0F2A20] py-2 px-3 bg-white opacity-70">
            <option>No background music</option>
          </select>
          <span className="w-9 h-9 rounded-xl bg-[#E1E7DF] text-[#145A41] flex items-center justify-center shrink-0 opacity-60"><span className="material-symbols-outlined text-[18px]">music_note</span></span>
        </div>
        <p className="text-[11px] text-[#54675D] mt-1.5">Music tracks arrive with the template library.</p>
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
