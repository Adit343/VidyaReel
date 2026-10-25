import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { Captions } from './Captions';
import { FPS, ThemeContext, themeFor } from './theme';
import { templates } from './templates';

export type VideoProps = {
  scenes: Scene[];
  /** 'forest' | 'saffron' | 'sage'; anything else falls back to forest. */
  theme?: string;
  captionsOn?: boolean;
};

export const Video: React.FC<VideoProps> = ({ scenes, theme: themeName, captionsOn = true }) => {
  const theme = themeFor(themeName);
  let from = 0;
  return (
    <ThemeContext.Provider value={theme}>
      <AbsoluteFill style={{ background: theme.canvas, fontFamily: theme.fontBody }}>
        {scenes.map((s) => {
          const frames = Math.round(((s.durationMs ?? 3000) / 1000) * FPS);
          const Template = templates[s.template];
          const el = (
            <Sequence key={s.id} from={from} durationInFrames={frames}>
              {Template ? <Template scene={s} /> : (
                <AbsoluteFill style={{ padding: 80, color: theme.ink, fontSize: 64 }}>{s.title ?? s.narration}</AbsoluteFill>
              )}
              {captionsOn && s.audio?.words.length ? <Captions words={s.audio.words} /> : null}
            </Sequence>
          );
          from += frames;
          return el;
        })}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
