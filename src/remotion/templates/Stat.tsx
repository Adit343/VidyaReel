import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, leadFirst, page, useHeadline, useReveal, type SceneProps } from './shared';

/** One big number (the "value" element), what it measures (next) and an optional note (last). */
export const Stat: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [value, label, note] = leadFirst(scene, /value|number|stat|figure/i);
  const p = useReveal(value?.startMs ?? 300);
  const text = value?.el.text ?? scene.title ?? '';
  return (
    <AbsoluteFill style={{ background: t.primary, ...page({ alignItems: 'center', textAlign: 'center' }) }}>
      <div style={{ width: 120, height: 14, background: t.spark, borderRadius: 7 }} />
      <div style={{ ...headline, color: t.onPrimary, fontSize: text.length > 7 ? 150 : 260, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: p }}>
        {text}
      </div>
      {label && (
        <Reveal startMs={label.startMs}>
          <div style={{ fontFamily: t.fontBody, color: t.onPrimary, fontSize: 72, fontWeight: 600, lineHeight: 1.2 }}>{label.el.text}</div>
        </Reveal>
      )}
      {note && (
        <Reveal startMs={note.startMs}>
          <div style={{ fontFamily: t.fontBody, color: t.onPrimaryMuted, fontSize: 54, lineHeight: 1.3 }}>{note.el.text}</div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
};
