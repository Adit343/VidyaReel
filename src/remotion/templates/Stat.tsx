import React from 'react';
import { interpolate } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, Stage, leadFirst, page, useHeadline, useReveal, type SceneProps } from './shared';

/** Counts the first number in `text` up from zero as `p` goes from 0 to 1 ("23.5°" shows 0.0° ... 23.5°); text without a number is unchanged. */
export function countUp(text: string, p: number): string {
  const m = text.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!m || p >= 1) return text;
  const [, before, num, after] = m;
  const decimals = num.includes('.') ? num.split('.')[1].length : 0;
  const shown = (Number(num.replace(/,/g, '')) * p).toFixed(decimals);
  return `${before}${num.includes(',') ? Number(shown).toLocaleString('en-US', { minimumFractionDigits: decimals }) : shown}${after}`;
}

/** One big number (the "value" element), what it measures (next) and an optional note (last). */
export const Stat: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [value, label, note] = leadFirst(scene, /value|number|stat|figure/i);
  const p = useReveal(value?.startMs ?? 300);
  const text = countUp(value?.el.text ?? scene.title ?? '', Math.min(1, Math.max(0, p)));
  const size = (value?.el.text ?? scene.title ?? '').length > 7 ? 150 : 260;
  return (
    <Stage bg={t.primary} style={page({ alignItems: 'center', textAlign: 'center' })}>
      <div style={{ width: 120, height: 14, background: t.spark, borderRadius: 7 }} />
      <div style={{ ...headline, color: t.onPrimary, fontSize: size, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: p }}>
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
    </Stage>
  );
};
