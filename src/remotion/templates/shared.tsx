import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { useTheme } from '../theme';

export type SceneProps = { scene: Scene };

/** Spring-in progress (0 to 1) for an element that should appear at `startMs`. */
export function useReveal(startMs: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - Math.round((startMs / 1000) * fps), fps, config: { damping: 13, stiffness: 150, mass: 0.9 } });
}

/** Cue time of element `i`, falling back to an even spread when sync has not set `startMs`. */
export const startOf = (scene: Scene, i: number) => scene.elements[i]?.startMs ?? 300 + i * 1200;

/**
 * Springs in on its cue: it slides up (or in from the side with `dx`), fades, grows slightly past its size and settles,
 * then floats a few pixels so a scene is never completely still.
 */
export const Reveal: React.FC<{ startMs: number; children: React.ReactNode; style?: React.CSSProperties; dx?: number }> = ({ startMs, children, style, dx = 0 }) => {
  const p = useReveal(startMs);
  const frame = useCurrentFrame();
  const settled = Math.min(1, Math.max(0, p));
  const bob = Math.sin(frame / 24 + startMs / 400) * 4 * settled;
  return (
    <div style={{
      opacity: Math.min(1, Math.max(0, p) * 2.2),
      transform: `translate(${(1 - p) * dx}px, ${(1 - p) * 56 + bob}px) scale(${0.9 + 0.1 * p})`,
      ...style,
    }}>
      {children}
    </div>
  );
};

/** Soft shapes drifting behind a scene, and small bubbles rising through it. */
export const Backdrop: React.FC<{ bg: string }> = ({ bg }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const [a, b] = bg === t.primary ? [t.spark, t.onPrimary] : [t.spark, t.primary];
  const blobs = [[8, 12, 340], [90, 26, 240], [12, 66, 300], [92, 76, 380], [52, 96, 260]];
  const bubbles = Array.from({ length: 9 }, (_, k) => k);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {blobs.map(([x, y, r], k) => (
        <div key={k} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, width: r, height: r, borderRadius: r, marginLeft: -r / 2, marginTop: -r / 2,
          background: k % 2 ? a : b, opacity: 0.08,
          transform: `translate(${Math.sin(frame / (46 + k * 8) + k) * 46}px, ${Math.cos(frame / (58 + k * 6) + k) * 46}px) scale(${1 + Math.sin(frame / 40 + k) * 0.08})`,
        }} />
      ))}
      {bubbles.map((k) => {
        const size = 14 + (k * 7) % 22;
        const rise = ((frame * (0.5 + (k % 4) * 0.22) + k * 230) % 2100) / 2100;
        return (
          <div key={`b${k}`} style={{
            position: 'absolute', left: `${6 + ((k * 37) % 88)}%`, top: `${108 - rise * 124}%`, width: size, height: size, borderRadius: size,
            background: k % 3 ? a : b, opacity: 0.16 * Math.sin(rise * Math.PI),
            transform: `translateX(${Math.sin(frame / 30 + k * 2) * 22}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** The page every template sits on: background colour, moving backdrop, and a slow zoom on the content. */
export const Stage: React.FC<{ bg: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ bg, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: bg }}>
      <Backdrop bg={bg} />
      <AbsoluteFill style={{ ...style, transform: `scale(${Math.min(1.04, 1 + frame * 0.00012)})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Headline text style in the current theme. */
export function useHeadline(): React.CSSProperties {
  const t = useTheme();
  return { fontFamily: t.fontHeadline, fontWeight: 800, color: t.ink, lineHeight: 1.08 };
}

/** Full-frame page with the shared padding every template uses. */
export const page = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding: '96px 96px 360px', justifyContent: 'center', gap: 56, ...extra,
});

/**
 * Elements are kept in spoken order, so the one that matters most (the figure, the formula) may not be first.
 * Returns it by type name when there is one, then the rest in their original order.
 */
export function leadFirst(scene: Scene, typePattern: RegExp) {
  const lead = scene.elements.findIndex((e) => typePattern.test(e.type));
  const order = scene.elements.map((_, i) => i);
  if (lead > 0) order.splice(0, 0, ...order.splice(lead, 1));
  return order.map((i) => ({ el: scene.elements[i], startMs: startOf(scene, i) }));
}

/** Splits "1905: Einstein publishes" into a label and a detail; no colon gives only a detail. */
export function splitLabel(text: string): { label?: string; detail: string } {
  const i = text.indexOf(':');
  if (i > 0 && i <= 24) return { label: text.slice(0, i).trim(), detail: text.slice(i + 1).trim() };
  return { detail: text };
}
