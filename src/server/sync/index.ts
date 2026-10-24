import type { Scene } from '@/lib/schemas/storyboard';
import type { Word } from '@/server/providers';

export const FPS = 30;
export const LEAD_IN_MS = 150;
export const TAIL_MS = 150;
const FRAME_MS = 1000 / FPS;
/** The visual lands three frames before the spoken word. */
const EARLY_MS = Math.round(3 * FRAME_MS);
/** The first element of a scene appears within the first second; templates show their label from frame 0. */
const FIRST_ELEMENT_MAX_MS = 1000;

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean);

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Index of the first word of a consecutive run matching the cue; exact first, then one edit per token. */
export function findCue(words: Word[], cue: string, from = 0): number {
  const tokens = words.map((w) => normalize(w.word).join(''));
  const want = normalize(cue);
  if (!want.length) return -1;
  for (const tolerance of [0, 1]) {
    for (let i = from; i + want.length <= tokens.length; i++) {
      if (want.every((t, k) => editDistance(tokens[i + k], t) <= tolerance)) return i;
    }
  }
  return -1;
}

export type SyncResult = {
  elements: (Scene['elements'][number] & { startMs: number })[];
  durationMs: number;
  /** Per element, ms from scene start of the cue word as spoken (null when the cue was not found). */
  cueWordMs: (number | null)[];
  warnings: string[];
};

/** Places each element on the voice clock (System-Design 7.3). Times are ms from the scene start. */
export function syncScene(scene: Scene, words: Word[], audioMs: number): SyncResult {
  const warnings: string[] = [];
  const total = LEAD_IN_MS + audioMs + TAIL_MS;
  const cueWordMs: (number | null)[] = [];
  let cursor = 0;
  const starts = scene.elements.map((el) => {
    let at = findCue(words, el.cue, cursor);
    if (at < 0) at = findCue(words, el.cue);
    if (at < 0) {
      warnings.push(`Cue "${el.cue}" not found for element ${el.id}`);
      cueWordMs.push(null);
      return null;
    }
    cursor = at;
    cueWordMs.push(LEAD_IN_MS + words[at].startMs);
    return Math.max(0, LEAD_IN_MS + words[at].startMs - EARLY_MS);
  });

  // Unmatched elements are spread evenly across the scene.
  const filled = starts.map((s, i) => s ?? Math.round(((i + 1) / (scene.elements.length + 1)) * total));
  let elements = scene.elements.map((el, i) => ({ ...el, startMs: filled[i] }));

  if (elements.length && elements[0].startMs > FIRST_ELEMENT_MAX_MS) {
    elements[0] = { ...elements[0], startMs: FIRST_ELEMENT_MAX_MS };
  }
  const sorted = [...elements].sort((a, b) => a.startMs - b.startMs);
  if (sorted.some((e, i) => e.id !== elements[i].id)) {
    warnings.push('Element cues were out of order; sorted by start time');
    elements = sorted;
  }
  return { elements, durationMs: total, cueWordMs, warnings };
}
