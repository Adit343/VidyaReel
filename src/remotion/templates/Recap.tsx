import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, page, startOf, useHeadline, type SceneProps } from './shared';

/** Closing scene: the key points ticked off one by one. */
export const Recap: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <AbsoluteFill style={{ background: t.primary, ...page({ gap: 44 }) }}>
      <div style={{ width: 120, height: 14, background: t.spark, borderRadius: 7 }} />
      <div style={{ ...headline, color: t.onPrimary, fontSize: 96 }}>{scene.title ?? 'Remember'}</div>
      {scene.elements.map((el, i) => (
        <Reveal key={el.id} startMs={startOf(scene, i)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
              <circle cx="42" cy="42" r="42" fill={t.spark} />
              <path d="M22 43 L37 58 L63 28" stroke={t.primary} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontFamily: t.fontBody, fontSize: 58, color: t.onPrimary, lineHeight: 1.25 }}>{el.text}</div>
          </div>
        </Reveal>
      ))}
    </AbsoluteFill>
  );
};
