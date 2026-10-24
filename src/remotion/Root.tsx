import React from 'react';
import { Composition } from 'remotion';
import { storyboardSchema } from '@/lib/schemas/storyboard';
import spike from './fixtures/spike-3-scenes.json';
import { Video, type VideoProps } from './Video';
import { FPS, HEIGHT, WIDTH } from './theme';

const defaultProps: VideoProps = { scenes: storyboardSchema.shape.scenes.parse(spike.scenes) };

export const Root: React.FC = () => (
  <Composition
    id="Video"
    component={Video}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS * 3}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(
        1,
        Math.round(props.scenes.reduce((n, s) => n + (s.durationMs ?? 3000), 0) / 1000 * FPS),
      ),
    })}
  />
);
