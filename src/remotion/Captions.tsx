import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { captionPage, type CaptionWord } from './captionPage';
import { useTheme } from './theme';

/** Word-by-word captions at the bottom of the frame: four words at a time, the spoken one highlighted. */
export const Captions: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  if (ms < words[0]?.startMs - 200) return null;
  const { page, active } = captionPage(words, ms);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 220, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: t.captionBg, borderRadius: 40, padding: '28px 44px', fontFamily: t.fontHeadline, fontWeight: 800, fontSize: 76, lineHeight: 1.1, textAlign: 'center', color: t.captionInk }}>
        {page.map((w, k) => (
          <span key={`${w.startMs}-${k}`} style={{ color: k === active ? t.spark : t.captionInk, marginRight: k < page.length - 1 ? 18 : 0 }}>{w.word}</span>
        ))}
      </div>
    </div>
  );
};
