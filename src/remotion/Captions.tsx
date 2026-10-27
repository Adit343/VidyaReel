import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { captionPage, type CaptionWord } from './captionPage';
import { useTheme } from './theme';

/** A page of long words gets a smaller size so it fits on one or two lines inside the 960 px band. */
export const captionFontSize = (chars: number) => (chars > 30 ? 60 : chars > 22 ? 68 : 76);

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
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 220, display: 'flex', justifyContent: 'center' }}>
      {/* The words are separate spans with no spaces between them, so the row must be a wrapping flex row or the
          whole page would be one unbreakable line that runs off both sides of the frame. */}
      <div style={{
        background: t.captionBg, borderRadius: 40, padding: '28px 44px', maxWidth: '100%', boxSizing: 'border-box',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 4,
        fontFamily: t.fontHeadline, fontWeight: 800, fontSize: size, lineHeight: 1.1, textAlign: 'center', color: t.captionInk,
      }}>
        {page.map((w, k) => (
          <span key={`${w.startMs}-${k}`} style={{ color: k === active ? t.spark : t.captionInk }}>{w.word}</span>
        ))}
      </div>
    </div>
  );
};
