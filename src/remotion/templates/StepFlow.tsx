import React from 'react';
import { useTheme } from '../theme';
import { Reveal, Stage, page, startOf, useHeadline, type SceneProps } from './shared';

/** Numbered steps joined by a vertical line; each step appears on its cue. */
export const StepFlow: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  return (
    <Stage bg={t.canvas} style={page({ gap: 40 })}>
      <div style={{ ...headline, fontSize: 84, color: t.primary, marginBottom: 16 }}>{scene.title}</div>
      {scene.elements.map((el, i) => (
        <Reveal key={el.id} startMs={startOf(scene, i)} dx={120}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
              <div style={{ ...headline, width: 120, height: 120, borderRadius: 60, background: t.primary, color: t.onPrimary, fontSize: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i + 1}
              </div>
              {i < scene.elements.length - 1 && (
                <div style={{ position: 'absolute', left: 54, top: 124, width: 12, height: 56, borderRadius: 6, background: t.spark }} />
              )}
            </div>
            <div style={{ flex: 1, background: t.surface, borderRadius: 36, padding: '36px 44px', fontFamily: t.fontBody, fontSize: 58, color: t.ink, lineHeight: 1.2 }}>
              {el.text}
            </div>
          </div>
        </Reveal>
      ))}
    </Stage>
  );
};
