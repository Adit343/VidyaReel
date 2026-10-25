'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { clock } from '@/lib/time';
import type { SceneView } from '@/server/videos/view';

export const TEMPLATE_LABEL: Record<string, string> = {
  'title-hook': 'Hook', 'bullet-reveal': 'Key points', 'definition-callout': 'Definition', 'step-flow': 'Steps', diagram: 'Diagram',
  stat: 'Stat', comparison: 'Comparison', timeline: 'Timeline', formula: 'Formula', 'stock-clip': 'Clip', recap: 'Recap',
};

// Browser only: the video templates load fonts and use the Remotion player.
const ScenePreview = dynamic(() => import('./ScenePreviewPlayer'), { ssr: false });

/** The 9:16 plate: the real video template for the scene, drawn by the player. The text layout below shows while it loads. */
function Plate({ scene, tone, theme }: { scene: SceneView; tone: string; theme: string }) {
  const [a, b] = scene.onScreenText;
  return (
    <div className={`w-[90px] h-[160px] rounded-xl bg-[#E1E7DF] border ${tone} shrink-0 relative overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner text-center`}>
      {scene.template === 'title-hook' && (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C] mb-2" />
          <span className="font-headline-sm text-[11px] leading-[13px] text-[#0F2A20] line-clamp-5 break-words">{a ?? scene.title}</span>
        </>
      )}
      {scene.template === 'bullet-reveal' && (
        <div className="w-full space-y-1.5 text-left">
          {scene.title && <span className="block font-headline-sm text-[9px] leading-[11px] text-[#145A41] line-clamp-2 mb-1">{scene.title}</span>}
          {scene.onScreenText.slice(0, 4).map((t, i) => (
            <div key={i} className="flex items-start gap-1">
              <span className="w-1 h-1 rounded-full bg-[#145A41] mt-[3px] shrink-0" />
              <span className="font-body-sm text-[8px] leading-[10px] text-[#0F2A20] line-clamp-3 break-words">{t}</span>
            </div>
          ))}
        </div>
      )}
      {scene.template !== 'title-hook' && scene.template !== 'bullet-reveal' && (
        <div className="w-full">
          <span className="block font-headline-sm text-[10px] leading-[12px] text-[#145A41] mb-1 line-clamp-2">{a ?? scene.title}</span>
          <span className="block font-body-sm text-[8px] leading-[10px] text-[#54675D] line-clamp-5 break-words">{b}</span>
        </div>
      )}
      <div className="absolute inset-0"><ScenePreview scene={scene} theme={theme} /></div>
      <span className="absolute top-1.5 left-1.5 z-10 font-code-sm text-[9px] px-1 py-0.5 rounded bg-white/80 border border-[#D3DBD0] text-[#54675D]">9:16</span>
    </div>
  );
}

export type SceneActions = {
  edit: () => void; regenerate: () => void; moveUp: () => void; moveDown: () => void; askDelete: () => void;
};

type Props = {
  scene: SceneView; theme: string; index: number; count: number; busy: boolean; editing: boolean; regenerating: boolean; confirmingDelete: boolean;
  actions: SceneActions;
  onSave: (v: { narration: string; text: string }) => void;
  onCancelEdit: () => void; onCancelRegenerate: () => void; onConfirmDelete: () => void; onCancelDelete: () => void;
};

export function SceneCard(p: Props) {
  const { scene, index } = p;
  const label = `Scene ${index + 1} · ${clock(scene.estimatedSec)}`;
  const badge = TEMPLATE_LABEL[scene.template] ?? scene.template;

  if (p.regenerating) {
    return (
      <article className="bg-white rounded-2xl border border-[#145A41]/40 p-4 sm:p-5 relative overflow-hidden shadow-sm" aria-busy="true">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-code-sm text-[11px] text-[#145A41] font-bold">{label}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#145A41]/10 text-[#145A41] font-code-sm text-[10px] font-semibold border border-[#145A41]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C] animate-ping" />Regenerating narration &amp; on-screen text...
            </span>
          </div>
          <button onClick={p.onCancelRegenerate} className="text-[11px] font-ui-medium text-[#54675D] hover:text-[#C93A2E]">Cancel</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
          <div className="w-[90px] h-[160px] rounded-xl shimmer-sage border border-[#D3DBD0] shrink-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-[#145A41]/40 animate-spin">refresh</span>
          </div>
          <div className="flex-1 flex flex-col justify-between py-1">
            <div className="space-y-3">
              <div className="h-4 w-32 rounded shimmer-sage" /><div className="h-4 w-full rounded shimmer-sage" />
              <div className="h-4 w-5/6 rounded shimmer-sage" /><div className="h-4 w-2/3 rounded shimmer-sage" />
            </div>
            <div className="pt-3 border-t border-[#EEF1EC] flex items-center justify-between">
              <div className="h-5 w-48 rounded-full shimmer-sage" /><div className="h-3 w-16 rounded shimmer-sage" />
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (p.editing) return <EditingCard {...p} label={label} />;

  return (
    <article id={`scene-${scene.id}`} className="bg-white rounded-2xl border border-[#D3DBD0] p-4 sm:p-5 transition-all duration-200 hover:shadow-[0_8px_24px_-4px_rgba(15,42,32,0.06)] hover:border-[#B9C5B5] group">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <Plate scene={scene} tone="border-[#D3DBD0]" theme={p.theme} />
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-code-sm text-[11px] text-[#54675D] font-bold tracking-tight">{label}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#E1E7DF] text-[#145A41] font-code-sm text-[10px] font-semibold">{badge}</span>
                {scene.needsCheck && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFDCBC] text-[#543000] font-code-sm text-[10px] font-bold flex items-center gap-1 border border-[#FF9F1C]/30">
                    <span className="material-symbols-outlined text-[13px] text-[#B36B00]">warning</span>Check this
                  </span>
                )}
              </div>
              <SceneMenu index={index} count={p.count} busy={p.busy} actions={p.actions} />
            </div>
            {scene.needsCheck && (
              <div className="mb-3 p-3 rounded-xl bg-[#FFF7ED] border border-[#FF9F1C]/40 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#B36B00] text-[18px] shrink-0 mt-0.5">lightbulb</span>
                <p className="text-body-sm text-[#0F2A20]">
                  <strong className="font-semibold text-[#543000]">Check this:</strong> {scene.checkNote ?? 'This scene has a number, date or claim. Verify it before you render.'}
                </p>
              </div>
            )}
            <div className="mb-3">
              <span className="block font-code-xs text-code-xs text-[#54675D] uppercase tracking-wider mb-1">Narration voiceover</span>
              <button
                type="button" onClick={p.actions.edit} disabled={p.busy}
                className="block w-full text-left text-body-md text-[#0F2A20] leading-relaxed hover:bg-[#EEF1EC]/60 p-2 -ml-2 rounded-lg cursor-text transition-colors border border-transparent hover:border-[#D3DBD0] disabled:cursor-default"
              >
                &ldquo;{scene.narration}&rdquo;
              </button>
            </div>
          </div>
          <div className="pt-2 border-t border-[#EEF1EC] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-code-xs text-code-xs text-[#54675D]">On-screen:</span>
              {scene.onScreenText.length ? scene.onScreenText.slice(0, 2).map((t, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-[#D6F5E5] text-[#145A41] font-ui-medium text-code-xs border border-[#D0E5D8] flex items-center gap-1.5 max-w-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#145A41] shrink-0" /><span className="truncate">&ldquo;{t}&rdquo;</span>
                </span>
              )) : <span className="font-code-xs text-code-xs text-[#54675D]">none</span>}
              {scene.onScreenText.length > 2 && <span className="font-code-xs text-code-xs text-[#54675D]">+{scene.onScreenText.length - 2} more</span>}
            </div>
            <span className="font-code-sm text-[11px] text-[#54675D]">{scene.words} words</span>
          </div>
        </div>
      </div>
      {p.confirmingDelete && (
        <div role="alertdialog" aria-label={`Delete scene ${index + 1}`} className="mt-4 pt-3 border-t border-[#D3DBD0] bg-[#FFF5F5] -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl flex items-center justify-between flex-wrap gap-2 animate-fade-in">
          <div className="flex items-center gap-2 text-[#C93A2E] font-ui-medium text-body-sm">
            <span className="material-symbols-outlined text-[18px]">delete</span>
            <span>Delete Scene {index + 1}? This removes visual &amp; narration.</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={p.onConfirmDelete} className="px-3 py-1 rounded-lg bg-[#C93A2E] text-white font-ui-medium text-code-sm hover:opacity-90 shadow-sm">Confirm Delete</button>
            <button onClick={p.onCancelDelete} className="px-3 py-1 rounded-lg bg-white border border-[#D3DBD0] text-[#0F2A20] font-ui-medium text-code-sm hover:bg-[#EEF1EC]">Cancel</button>
          </div>
        </div>
      )}
    </article>
  );
}

function EditingCard(p: Props & { label: string }) {
  const { scene } = p;
  const [narration, setNarration] = useState(scene.narration);
  const [text, setText] = useState(scene.onScreenText[0] ?? '');
  const box = useRef<HTMLElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { area.current?.focus(); area.current?.setSelectionRange(narration.length, narration.length); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = narration.trim() !== scene.narration || text.trim() !== (scene.onScreenText[0] ?? '');
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  const save = () => (dirty && narration.trim() ? p.onSave({ narration: narration.trim(), text: text.trim() }) : p.onCancelEdit());

  return (
    <article
      ref={box} id={`scene-${scene.id}`}
      onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) save(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') p.onCancelEdit(); }}
      className="bg-white rounded-2xl border-2 border-[#145A41] ring-4 ring-[#145A41]/10 p-4 sm:p-5 shadow-[0_12px_32px_-8px_rgba(20,90,65,0.08)] transition-all duration-200"
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <Plate scene={scene} tone="border-[#145A41]/30" theme={p.theme} />
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-code-sm text-[11px] text-[#145A41] font-bold tracking-tight">{p.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#ADF1D0] text-[#145A41] font-code-sm text-[10px] font-bold">Active Editing</span>
              </div>
              <div className="flex items-center gap-2 font-code-sm text-[11px] text-[#145A41] font-medium">
                <span>{narration.length} chars</span><span>·</span><span>~{Math.max(1, Math.round(words / 2.3))}s</span>
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor={`narr-${scene.id}`} className="block font-code-xs text-code-xs text-[#145A41] font-semibold uppercase tracking-wider mb-1">Narration Voiceover (Editing)</label>
              <textarea
                id={`narr-${scene.id}`} ref={area} rows={3} value={narration} maxLength={600} onChange={(e) => setNarration(e.target.value)}
                className="w-full rounded-xl bg-[#EEF1EC]/30 border border-[#145A41] text-[#0F2A20] text-body-md p-3 focus:outline-none focus:ring-2 focus:ring-[#145A41]/20 resize-none leading-relaxed"
              />
              {!narration.trim() && <p className="text-[11px] text-[#C93A2E] mt-1">Narration cannot be empty.</p>}
            </div>
            <div className="mb-3">
              <label htmlFor={`text-${scene.id}`} className="block font-code-xs text-code-xs text-[#54675D] uppercase tracking-wider mb-1">On-Screen Key Takeaway</label>
              <div className="flex items-center gap-2">
                <span className="font-code-sm text-[11px] text-[#54675D]">T:</span>
                <input
                  id={`text-${scene.id}`} type="text" value={text} maxLength={120} onChange={(e) => setText(e.target.value)}
                  className="flex-1 rounded-lg border border-[#D3DBD0] px-3 py-1.5 text-body-sm font-ui-medium text-[#0F2A20] focus:border-[#145A41] focus:ring-1 focus:ring-[#145A41] outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-[#EEF1EC] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={save} disabled={!narration.trim()} className="px-4 py-1.5 rounded-full bg-[#145A41] text-white font-ui-medium text-code-sm hover:bg-[#0F4632] active:scale-[0.99] transition-transform shadow-sm disabled:opacity-50">Save changes</button>
              <button onClick={p.onCancelEdit} className="px-3 py-1.5 rounded-full bg-transparent hover:bg-[#EEF1EC] text-[#54675D] font-ui-medium text-code-sm transition-colors">Cancel</button>
            </div>
            <span className="font-code-sm text-[11px] text-[#54675D]">Auto-saves on blur</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function SceneMenu({ index, count, busy, actions }: { index: number; count: number; busy: boolean; actions: SceneActions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const item = (icon: string, text: string, run: () => void, disabled = false, danger = false) => (
    <button
      role="menuitem" disabled={disabled} onClick={() => { setOpen(false); run(); }}
      className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-[13px] hover:bg-[#EEF1EC] disabled:opacity-40 disabled:hover:bg-transparent ${danger ? 'text-[#C93A2E]' : 'text-[#0F2A20]'}`}
    ><span className="material-symbols-outlined text-[16px]">{icon}</span>{text}</button>
  );
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Scene actions" aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)}
        className="p-1 rounded text-[#54675D] hover:text-[#0F2A20] hover:bg-[#EEF1EC] transition-colors disabled:opacity-40"
      ><span className="material-symbols-outlined text-[18px]">more_vert</span></button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-20 w-52 bg-white border border-[#B9C5B5] rounded-xl p-1.5 overlay-ambient-shadow animate-fade-in">
          {item('edit', 'Edit text', actions.edit)}
          {item('autorenew', 'Regenerate scene', actions.regenerate)}
          {item('arrow_upward', 'Move up', actions.moveUp, index === 0)}
          {item('arrow_downward', 'Move down', actions.moveDown, index === count - 1)}
          <div className="my-1 border-t border-[#EEF1EC]" />
          {item('delete', 'Delete scene', actions.askDelete, count <= 1, true)}
        </div>
      )}
    </div>
  );
}
