import React from 'react';
import { AbsoluteFill } from 'remotion';
import { theme } from '../theme';
import { Reveal, headline, startOf, type SceneProps } from './shared';

export const TitleHook: React.FC<SceneProps> = ({ scene }) => {
  const [title, sub] = scene.elements;
  return (
    <AbsoluteFill style={{ background: theme.primary, padding: 96, justifyContent: 'center', gap: 48 }}>
      <div style={{ width: 120, height: 14, background: theme.spark, borderRadius: 7 }} />
      <Reveal startMs={startOf(scene, 0)}>
        <div style={{ ...headline, color: '#fff', fontSize: 150 }}>{title?.text ?? scene.title}</div>
      </Reveal>
      {sub && (
        <Reveal startMs={startOf(scene, 1)}>
          <div style={{ fontFamily: theme.fontBody, color: '#D7E8DF', fontSize: 64, lineHeight: 1.25 }}>{sub.text}</div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
};
