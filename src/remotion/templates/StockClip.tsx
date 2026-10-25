import React from 'react';
import { AbsoluteFill, Loop, OffthreadVideo } from 'remotion';
import { FPS, useTheme } from '../theme';
import { Reveal, startOf, useHeadline, type SceneProps } from './shared';

/**
 * A stock clip filling the 9:16 frame (any shape is cropped to cover it) with the scene's lines on a
 * dark band at the bottom. The clip's own sound is muted. Without a clip file the scene falls back to
 * a plain brand-colour background, so it is never empty.
 */
export const StockClip: React.FC<SceneProps> = ({ scene }) => {
  const t = useTheme();
  const headline = useHeadline();
  const url = scene.media?.url;
  const clipFrames = scene.media?.durationSec ? Math.max(1, Math.round(scene.media.durationSec * FPS)) : undefined;
  const video = url && (
    <OffthreadVideo src={url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  );
  return (
    <AbsoluteFill style={{ background: t.primary }}>
      {video && (clipFrames ? <Loop durationInFrames={clipFrames}>{video}</Loop> : video)}
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0) 62%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 96px 400px', gap: 28 }}>
        {scene.title && <div style={{ ...headline, color: '#fff', fontSize: 92, textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>{scene.title}</div>}
        {scene.elements.map((el, i) => (
          <Reveal key={el.id} startMs={startOf(scene, i)}>
            <div style={{ fontFamily: t.fontBody, fontWeight: 600, color: '#fff', fontSize: 56, lineHeight: 1.25, borderLeft: `12px solid ${t.spark}`, paddingLeft: 28, textShadow: '0 3px 18px rgba(0,0,0,0.6)' }}>
              {el.text}
            </div>
          </Reveal>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
