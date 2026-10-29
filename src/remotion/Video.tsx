import React from 'react';
import { AbsoluteFill, Audio, Sequence } from 'remotion';
import type { Scene } from '@/lib/schemas/storyboard';
import { Captions } from './Captions';
import { MusicBed } from './MusicBed';
import { speechWindows } from './music';
import { LEAD_IN_MS } from '@/server/sync';
import { FPS, ThemeContext, themeFor } from './theme';
import { templates } from './templates';

export type VideoProps = {
  scenes: Scene[];
  /** A name from THEMES in theme.ts (forest, saffron, sage, chalkboard, ...); anything else falls back to forest. */
  theme?: string;
  captionsOn?: boolean;
  /** Background track: a link to the file and the level (0 to 1) while the narrator speaks. */
  music?: { url: string; volume: number };
};

export const Video: React.FC<VideoProps> = ({ scenes, theme: themeName, captionsOn = true, music }) => {
  const theme = themeFor(themeName);
  let from = 0;
  return (
    <ThemeContext.Provider value={theme}>
      <AbsoluteFill style={{ background: theme.canvas, fontFamily: theme.fontBody }}>
        {music && music.volume > 0 && <MusicBed url={music.url} volume={music.volume} windows={speechWindows(scenes)} />}
        {scenes.map((s) => {
          const frames = Math.round(((s.durationMs ?? 3000) / 1000) * FPS);
          const Template = templates[s.template];
          const el = (
            <Sequence key={s.id} from={from} durationInFrames={frames}>
              {Template ? <Template scene={s} /> : (
                <AbsoluteFill style={{ padding: 80, color: theme.ink, fontSize: 64 }}>{s.title ?? s.narration}</AbsoluteFill>
              )}
              {/* Word times in the props are scene times, so the narration starts after the same lead-in. */}
              {s.audio?.url && (
                <Sequence from={Math.round((LEAD_IN_MS / 1000) * FPS)} layout="none"><Audio src={s.audio.url} /></Sequence>
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
