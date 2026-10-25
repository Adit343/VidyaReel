import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useTheme } from '../theme';
import { Reveal, page, startOf, useHeadline, type SceneProps } from './shared';

export const DefinitionCallout: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [term, definition] = scene.elements;
  return (
    <AbsoluteFill style={{ background: t.canvas, ...page() }}>
      <div style={{ fontFamily: t.fontBody, fontSize: 40, letterSpacing: 6, color: t.muted, textTransform: 'uppercase' }}>Definition</div>
      <Reveal startMs={startOf(scene, 0)}>
        <div style={{ ...headline, fontSize: 128, color: t.primary }}>{term?.text ?? scene.title}</div>
      </Reveal>
      {definition && (
        <Reveal startMs={startOf(scene, 1)}>
          <div style={{ background: t.surface, borderLeft: `18px solid ${t.spark}`, borderRadius: 32, padding: '52px 56px', fontFamily: t.fontBody, fontSize: 62, color: t.ink, lineHeight: 1.3 }}>
            {definition.text}
          </div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
};
