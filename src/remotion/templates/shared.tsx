import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { useTheme } from '../theme';

export type SceneProps = { scene: Scene };

/** Spring-in progress (0 to 1) for an element that should appear at `startMs`. */
export function useReveal(startMs: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - Math.round((startMs / 1000) * fps), fps, config: { damping: 18, stiffness: 140 } });
}

/** Cue time of element `i`, falling back to an even spread when sync has not set `startMs`. */
export const startOf = (scene: Scene, i: number) => scene.elements[i]?.startMs ?? 300 + i * 1200;

export const Reveal: React.FC<{ startMs: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ startMs, children, style }) => {
  const p = useReveal(startMs);
  return (
    <div style={{ opacity: interpolate(p, [0, 1], [0, 1]), transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`, ...style }}>
      {children}
    </div>
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
