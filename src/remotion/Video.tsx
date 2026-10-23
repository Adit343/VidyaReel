import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { FPS, theme } from './theme';

export type VideoProps = { scenes: Scene[] };

// TODO(M4): render per-template components from ./templates.
export const Video: React.FC<VideoProps> = ({ scenes }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: theme.canvas, fontFamily: theme.fontBody }}>
      {scenes.map((s) => {
        const frames = Math.round(((s.durationMs ?? 3000) / 1000) * FPS);
        const el = (
          <Sequence key={s.id} from={from} durationInFrames={frames}>
            <AbsoluteFill style={{ padding: 80, color: theme.ink, fontSize: 64 }}>{s.title ?? s.narration}</AbsoluteFill>
          </Sequence>
        );
        from += frames;
        return el;
      })}
    </AbsoluteFill>
  );
};
