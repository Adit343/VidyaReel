import React from 'react';
import { AbsoluteFill } from 'remotion';
import { theme } from '../theme';
import { Reveal, headline, startOf, type SceneProps } from './shared';

export const BulletReveal: React.FC<SceneProps> = ({ scene }) => (
  <AbsoluteFill style={{ background: theme.canvas, padding: 96, justifyContent: 'center', gap: 56 }}>
    {/* The label is on screen from frame 0 so the scene is never empty before the first cue. */}
    <div style={{ ...headline, fontSize: 84, color: theme.primary }}>{scene.title}</div>
    {scene.elements.map((el, i) => (
      <Reveal key={el.id} startMs={startOf(scene, i)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, background: theme.surface, borderRadius: 40, padding: '44px 52px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: theme.spark, flexShrink: 0 }} />
          <div style={{ fontFamily: theme.fontBody, fontSize: 62, color: theme.ink, lineHeight: 1.2 }}>{el.text}</div>
        </div>
      </Reveal>
    ))}
  </AbsoluteFill>
);
