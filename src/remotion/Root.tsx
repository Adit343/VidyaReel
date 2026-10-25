import React from 'react';
import { Composition } from 'remotion';
import { storyboardSchema, type Scene } from '@/lib/schemas/storyboard';
import allTemplates from './fixtures/all-templates.json';
import spike from './fixtures/spike-3-scenes.json';
import { Video, type VideoProps } from './Video';
import { FPS, HEIGHT, WIDTH } from './theme';

const parse = (scenes: unknown) => storyboardSchema.shape.scenes.parse(scenes);

/** Sample scenes get evenly spaced word times so the captions show up in Studio and in stills. */
function withWords(scenes: Scene[]): Scene[] {
  return scenes.map((s) => {
    const words = s.narration.split(/\s+/);
    const per = ((s.durationMs ?? 3000) - 600) / words.length;
    return {
      ...s,
      audio: { key: 'sample', hash: 'sample', durationMs: s.durationMs ?? 3000, words: words.map((w, i) => ({ word: w, startMs: Math.round(300 + i * per), endMs: Math.round(300 + (i + 1) * per) })) },
    };
  });
}

const totalFrames = (props: VideoProps) =>
  Math.max(1, Math.round(props.scenes.reduce((n, s) => n + (s.durationMs ?? 3000), 0) / 1000 * FPS));

const comp = (id: string, defaultProps: VideoProps) => (
  <Composition
    id={id}
    component={Video}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS * 3}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props) })}
  />
);

export const Root: React.FC = () => (
  <>
    {comp('Video', { scenes: parse(spike.scenes) })}
    {/* One scene per template with captions; change `theme` in Studio to check forest, saffron and sage. */}
    {comp('AllTemplates', { scenes: withWords(parse(allTemplates.scenes)), theme: 'forest', captionsOn: true })}
  </>
);
