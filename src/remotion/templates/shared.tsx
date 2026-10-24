import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { theme } from '../theme';

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

export const headline: React.CSSProperties = { fontFamily: theme.fontHeadline, fontWeight: 800, color: theme.ink, lineHeight: 1.08 };
