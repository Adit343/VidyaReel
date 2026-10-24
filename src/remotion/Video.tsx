import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { FPS, theme } from './theme';
import { templates } from './templates';

export type VideoProps = { scenes: Scene[] };

export const Video: React.FC<VideoProps> = ({ scenes }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: theme.canvas, fontFamily: theme.fontBody }}>
      {scenes.map((s) => {
        const frames = Math.round(((s.durationMs ?? 3000) / 1000) * FPS);
        const Template = templates[s.template];
        const el = (
          <Sequence key={s.id} from={from} durationInFrames={frames}>
            {Template ? <Template scene={s} /> : (
              <AbsoluteFill style={{ padding: 80, color: theme.ink, fontSize: 64 }}>{s.title ?? s.narration}</AbsoluteFill>
            )}
          </Sequence>
        );
        from += frames;
        return el;
      })}
    </AbsoluteFill>
  );
};
