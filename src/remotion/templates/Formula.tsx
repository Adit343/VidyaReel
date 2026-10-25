import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, leadFirst, page, useHeadline, type SceneProps } from './shared';

/** The formula (the "formula" element) big on a card, then one line per variable or note. */
export const Formula: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [formula, ...notes] = leadFirst(scene, /formula|equation/i);
  const text = formula?.el.text ?? scene.title ?? '';
  return (
    <AbsoluteFill style={{ background: t.canvas, ...page() }}>
      <div style={{ fontFamily: t.fontBody, fontSize: 40, letterSpacing: 6, color: t.muted, textTransform: 'uppercase' }}>{scene.title ?? 'Formula'}</div>
      <Reveal startMs={formula?.startMs ?? 300}>
        <div style={{ ...headline, background: t.primary, color: t.onPrimary, borderRadius: 48, padding: '84px 56px', textAlign: 'center', fontSize: text.length > 14 ? 96 : 130, borderBottom: `20px solid ${t.spark}` }}>
          {text}
        </div>
      </Reveal>
      {notes.map((n) => (
        <Reveal key={n.el.id} startMs={n.startMs}>
          <div style={{ fontFamily: t.fontBody, fontSize: 56, color: t.ink, lineHeight: 1.25, background: t.surface, borderRadius: 32, padding: '28px 44px' }}>{n.el.text}</div>
        </Reveal>
      ))}
    </AbsoluteFill>
  );
};
