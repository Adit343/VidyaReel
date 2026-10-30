import React from 'react';
import { useTheme } from '../theme';
import { Reveal, Stage, page, startOf, useHeadline, type SceneProps } from './shared';

export const BulletReveal: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <Stage bg={t.canvas} style={page()}>
      {/* The label is on screen from frame 0 so the scene is never empty before the first cue. */}
      <div style={{ ...headline, fontSize: 84, color: t.primary }}>{scene.title}</div>
      {scene.elements.map((el, i) => (
        <Reveal key={el.id} startMs={startOf(scene, i)} dx={-120}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36, background: t.surface, borderRadius: 40, padding: '44px 52px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: t.spark, flexShrink: 0 }} />
            <div style={{ fontFamily: t.fontBody, fontSize: 62, color: t.ink, lineHeight: 1.2 }}>{el.text}</div>
          </div>
        </Reveal>
      ))}
    </Stage>
  );
};
