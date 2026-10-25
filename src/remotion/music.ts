/** Time span, in milliseconds from the start of the video, in which the narrator is speaking. */
export type Window = { startMs: number; endMs: number };

type SceneTiming = { durationMs?: number; audio?: { words: { startMs: number; endMs: number }[] } };

/**
 * Where the narrator speaks, across the whole video: each scene's words, shifted by the scene's start.
 * Words closer together than `joinMs` become one span, so the music does not pump between words.
 */
export function speechWindows(scenes: SceneTiming[], joinMs = 450): Window[] {
  const out: Window[] = [];
  let offset = 0;
  for (const s of scenes) {
    for (const w of s.audio?.words ?? []) {
      const win = { startMs: offset + w.startMs, endMs: offset + w.endMs };
      const last = out[out.length - 1];
      if (last && win.startMs - last.endMs <= joinMs) last.endMs = Math.max(last.endMs, win.endMs);
      else out.push(win);
    }
    offset += s.durationMs ?? 3000;
  }
  return out;
}

export type DuckOptions = {
  /** Level while the narrator speaks (0 to 1): the slider value. */
  speech: number;
  /** Level in the pauses, the intro and the ending. */
  gap?: number;
  /** Time to move between the two levels. */
  rampMs?: number;
  /** Fade to silence over the last part of the video. */
  fadeOutMs?: number;
  totalMs?: number;
};

/** Music level (0 to 1) at `ms`: low under speech, higher in the gaps, with short ramps in between. */
export function musicGain(ms: number, windows: Window[], o: DuckOptions): number {
  const { speech, rampMs = 300, fadeOutMs = 1500, totalMs } = o;
  const gap = o.gap ?? Math.min(0.8, speech * 2);
  // 0 inside speech, 1 far from it; the ramp starts rampMs before a window and ends rampMs after it.
  let away = 1;
  for (const w of windows) {
    const d = ms < w.startMs ? w.startMs - ms : ms > w.endMs ? ms - w.endMs : 0;
    away = Math.min(away, Math.min(1, d / rampMs));
    if (away === 0) break;
  }
  let level = speech + (gap - speech) * away;
  if (totalMs !== undefined && fadeOutMs > 0 && ms > totalMs - fadeOutMs) level *= Math.max(0, (totalMs - ms) / fadeOutMs);
  return Math.max(0, Math.min(1, level));
}
