export type CaptionWord = { word: string; startMs: number; endMs: number };

export const WORDS_PER_PAGE = 4;

/** The page of words holding the spoken word at `ms` (a gap between words keeps the previous word). */
export function captionPage(words: CaptionWord[], ms: number): { page: CaptionWord[]; active: number } {
  if (!words.length) return { page: [], active: -1 };
  let i = words.findIndex((w) => ms < w.endMs);
  if (i === -1) i = words.length - 1;
  if (ms < words[i].startMs && i > 0 && Math.floor((i - 1) / WORDS_PER_PAGE) === Math.floor(i / WORDS_PER_PAGE)) i -= 1;
  const start = Math.floor(i / WORDS_PER_PAGE) * WORDS_PER_PAGE;
  return { page: words.slice(start, start + WORDS_PER_PAGE), active: i - start };
}
