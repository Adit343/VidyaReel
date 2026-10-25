import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, page, startOf, useHeadline, type SceneProps } from './shared';

export const TitleHook: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [title, sub] = scene.elements;
  return (
    <AbsoluteFill style={{ background: t.primary, ...page() }}>
      <div style={{ width: 120, height: 14, background: t.spark, borderRadius: 7 }} />
      <Reveal startMs={startOf(scene, 0)}>
        <div style={{ ...headline, color: t.onPrimary, fontSize: 150 }}>{title?.text ?? scene.title}</div>
      </Reveal>
      {sub && (
        <Reveal startMs={startOf(scene, 1)}>
          <div style={{ fontFamily: t.fontBody, color: t.onPrimaryMuted, fontSize: 64, lineHeight: 1.25 }}>{sub.text}</div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
};
