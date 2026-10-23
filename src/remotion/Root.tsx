import React from 'react';
import { Composition } from 'remotion';
import { Video, type VideoProps } from './Video';
import { FPS, HEIGHT, WIDTH } from './theme';

export const Root: React.FC = () => (
  <Composition
    id="Video"
    component={Video}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS * 3}
    defaultProps={{ scenes: [] } satisfies VideoProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(
        1,
        Math.round(props.scenes.reduce((n, s) => n + (s.durationMs ?? 3000), 0) / 1000 * FPS),
      ),
    })}
  />
);
