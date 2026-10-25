import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, page, splitLabel, startOf, useHeadline, type SceneProps } from './shared';

/** Events down a vertical line. Text like "1905: Einstein publishes" shows "1905" as the date. */
export const Timeline: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <AbsoluteFill style={{ background: t.canvas, ...page({ gap: 36 }) }}>
      <div style={{ ...headline, fontSize: 84, color: t.primary, marginBottom: 12 }}>{scene.title}</div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 44, paddingLeft: 70 }}>
        <div style={{ position: 'absolute', left: 22, top: 20, bottom: 20, width: 10, borderRadius: 5, background: t.muted, opacity: 0.35 }} />
        {scene.elements.map((el, i) => {
          const { label, detail } = splitLabel(el.text);
          return (
            <Reveal key={el.id} startMs={startOf(scene, i)}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: -71, top: 14, width: 44, height: 44, borderRadius: 22, background: t.spark, boxShadow: `0 0 0 8px ${t.canvas}` }} />
                {label && <div style={{ ...headline, fontSize: 70, color: t.primary }}>{label}</div>}
                <div style={{ fontFamily: t.fontBody, fontSize: 54, color: t.ink, lineHeight: 1.25 }}>{detail}</div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
