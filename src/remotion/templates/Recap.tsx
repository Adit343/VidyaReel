import React from 'react';
import { useTheme } from '../theme';
import { Reveal, Stage, page, startOf, useHeadline, useReveal, type SceneProps } from './shared';

/** A round tick whose check mark draws itself. */
const Tick: React.FC<{ startMs: number }> = ({ startMs }) => {
  const t = useTheme();
  const p = Math.min(1, Math.max(0, useReveal(startMs)));
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r="42" fill={t.spark} transform={`rotate(${(1 - p) * -90} 42 42)`} />
      <path d="M22 43 L37 58 L63 28" stroke={t.primary} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={60} strokeDashoffset={60 * (1 - p)} />
    </svg>
  );
};

/** Closing scene: the key points ticked off one by one. */
export const Recap: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <Stage bg={t.primary} style={page({ gap: 44 })}>
      <div style={{ width: 120, height: 14, background: t.spark, borderRadius: 7 }} />
      <div style={{ ...headline, color: t.onPrimary, fontSize: 96 }}>{scene.title ?? 'Remember'}</div>
      {scene.elements.map((el, i) => (
        <Reveal key={el.id} startMs={startOf(scene, i)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            <Tick startMs={startOf(scene, i) + 150} />
            <div style={{ fontFamily: t.fontBody, fontSize: 58, color: t.onPrimary, lineHeight: 1.25 }}>{el.text}</div>
          </div>
        </Reveal>
      ))}
    </Stage>
  );
};
