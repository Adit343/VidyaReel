import React from 'react';
import { useTheme } from '../theme';
import { Reveal, Stage, page, startOf, useHeadline, useReveal, type SceneProps } from './shared';

/** The short accent bar draws itself out when the scene opens. */
const AccentBar: React.FC = () => {
  const t = useTheme();
  const p = useReveal(0);
  return <div style={{ width: 120 + 160 * p, height: 14, background: t.spark, borderRadius: 7 }} />;
};

export const TitleHook: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const [title, sub] = scene.elements;
  return (
    <Stage bg={t.primary} style={page()}>
      <AccentBar />
      <Reveal startMs={startOf(scene, 0)}>
        <div style={{ ...headline, color: t.onPrimary, fontSize: 150 }}>{title?.text ?? scene.title}</div>
      </Reveal>
      {sub && (
        <Reveal startMs={startOf(scene, 1)}>
          <div style={{ fontFamily: t.fontBody, color: t.onPrimaryMuted, fontSize: 64, lineHeight: 1.25 }}>{sub.text}</div>
        </Reveal>
      )}
    </Stage>
  );
};
