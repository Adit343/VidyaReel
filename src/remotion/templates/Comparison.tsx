import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, page, startOf, useHeadline, type SceneProps } from './shared';

/**
 * Two stacked panels. Elements of type "right" go to the second panel, the rest to the first;
 * with no "right" elements the list is split in half. The first element of each side is its heading.
 */
export const Comparison: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const idx = scene.elements.map((_, i) => i);
  const hasTypes = scene.elements.some((e) => e.type.toLowerCase().startsWith('right'));
  const half = Math.ceil(idx.length / 2);
  const right = hasTypes ? idx.filter((i) => scene.elements[i].type.toLowerCase().startsWith('right')) : idx.slice(half);
  const left = idx.filter((i) => !right.includes(i));
  const panel = (ids: number[], fill: string, ink: string, bar: string) => (
    <div style={{ background: fill, borderRadius: 48, padding: '44px 52px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: 300 }}>
      {ids.map((i, k) => (
        <Reveal key={scene.elements[i].id} startMs={startOf(scene, i)}>
          <div style={k === 0
            ? { ...headline, color: ink, fontSize: 76 }
            : { fontFamily: t.fontBody, color: ink, fontSize: 52, lineHeight: 1.25, borderLeft: `10px solid ${bar}`, paddingLeft: 28 }}>
            {scene.elements[i].text}
          </div>
        </Reveal>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: t.canvas, ...page({ gap: 32 }) }}>
      <div style={{ ...headline, fontSize: 72, color: t.primary }}>{scene.title}</div>
      {panel(left, t.surface, t.ink, t.spark)}
      {panel(right, t.primary, t.onPrimary, t.spark)}
    </AbsoluteFill>
  );
};
