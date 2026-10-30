import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { captionPage, type CaptionWord } from './captionPage';
import { useTheme } from './theme';

/** A page of long words gets a smaller size so it stays on one or two short lines and leaves the picture visible. */
export const captionFontSize = (chars: number) => (chars > 30 ? 44 : chars > 22 ? 48 : 54);

/** Word-by-word captions at the bottom of the frame: four words at a time, the spoken one highlighted. */
export const Captions: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  if (ms < words[0]?.startMs - 200) return null;
  const { page, active } = captionPage(words, ms);
  const size = captionFontSize(page.reduce((n, w) => n + w.word.length, 0) + page.length - 1);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, bottom: 190, display: 'flex', justifyContent: 'center' }}>
      {/* The words are separate spans with no spaces between them, so the row must be a wrapping flex row or the
          whole page would be one unbreakable line that runs off both sides of the frame. */}
      <div style={{
        background: t.captionBg, opacity: 0.92, borderRadius: 28, padding: '16px 30px', maxWidth: '100%', boxSizing: 'border-box',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 2,
        fontFamily: t.fontHeadline, fontWeight: 800, fontSize: size, lineHeight: 1.15, textAlign: 'center', color: t.captionInk,
      }}>
        {page.map((w, k) => (
          <span key={`${w.startMs}-${k}`} style={{ color: k === active ? t.spark : t.captionInk }}>{w.word}</span>
        ))}
      </div>
    </div>
  );
};
