import React from 'react';
import { AbsoluteFill } from 'remotion';
import { theme } from '../theme';
import { Reveal, headline, startOf, type SceneProps } from './shared';

export const DefinitionCallout: React.FC<SceneProps> = ({ scene }) => {
  const [term, definition] = scene.elements;
  return (
    <AbsoluteFill style={{ background: theme.canvas, padding: 96, justifyContent: 'center', gap: 56 }}>
      <div style={{ fontFamily: theme.fontBody, fontSize: 40, letterSpacing: 6, color: theme.muted, textTransform: 'uppercase' }}>Definition</div>
      <Reveal startMs={startOf(scene, 0)}>
        <div style={{ ...headline, fontSize: 128, color: theme.primary }}>{term?.text ?? scene.title}</div>
      </Reveal>
      {definition && (
        <Reveal startMs={startOf(scene, 1)}>
          <div style={{ background: theme.surface, borderLeft: `18px solid ${theme.spark}`, borderRadius: 32, padding: '52px 56px', fontFamily: theme.fontBody, fontSize: 62, color: theme.ink, lineHeight: 1.3 }}>
            {definition.text}
          </div>
        </Reveal>
      )}
    </AbsoluteFill>
  );
};
