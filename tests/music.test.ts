import { describe, expect, it } from 'vitest';
import { MUSIC } from '@/config/music';
import { updateVideoSchema } from '@/lib/schemas/video';
import { musicGain, speechWindows } from '@/remotion/music';
import type { StorageProvider } from '@/server/providers';
import { availableMusic, musicUrl } from '@/server/music';

const words = (...t: [number, number][]) => t.map(([startMs, endMs]) => ({ word: 'w', startMs, endMs }));

describe('speech windows', () => {
  it('shifts each scene by the scenes before it and joins words that are close together', () => {
    const w = speechWindows([
      { durationMs: 4000, audio: { words: words([500, 900], [1000, 1400], [3000, 3400]) } },
      { durationMs: 3000, audio: { words: words([200, 600]) } },
      { durationMs: 2000 },
    ]);
    expect(w).toEqual([{ startMs: 500, endMs: 1400 }, { startMs: 3000, endMs: 3400 }, { startMs: 4200, endMs: 4600 }]);
  });
});

describe('music ducking', () => {
  const windows = [{ startMs: 2000, endMs: 5000 }];
  const o = { speech: 0.3, rampMs: 300 };

  it('stays low while the narrator speaks and rises in the gaps', () => {
    expect(musicGain(3000, windows, o)).toBeCloseTo(0.3);
    expect(musicGain(0, windows, o)).toBeCloseTo(0.6);
    expect(musicGain(9000, windows, o)).toBeCloseTo(0.6);
  });

  it('ramps between the levels instead of jumping', () => {
    const before = musicGain(1850, windows, o);
    expect(before).toBeGreaterThan(0.3);
    expect(before).toBeLessThan(0.6);
    expect(musicGain(5150, windows, o)).toBeCloseTo(before);
  });

  it('plays at the slider level all through a video with no narration times', () => {
    expect(musicGain(1000, [], { speech: 0.35 })).toBeCloseTo(0.7);
  });

  it('never goes above 1 and fades to silence at the end', () => {
    expect(musicGain(0, [], { speech: 0.9 })).toBeLessThanOrEqual(0.8);
    const o2 = { speech: 0.3, totalMs: 10_000, fadeOutMs: 1000 };
    expect(musicGain(9500, [], o2)).toBeCloseTo(0.3);
    expect(musicGain(10_000, [], o2)).toBe(0);
  });
});

describe('music tracks', () => {
  const files = new Set<string>();
  const storage = {
    list: async () => [], deletePrefix: async () => 0, exists: async (k: string) => files.has(k),
    signedGet: async (k: string) => `https://signed.example/${k}`,
  } as unknown as StorageProvider;

  it('offers only tracks that were uploaded', async () => {
    expect(await availableMusic(storage)).toEqual([]);
    files.add(`music/${MUSIC[0].id}.mp3`);
    expect((await availableMusic(storage)).map((t) => t.id)).toEqual([MUSIC[0].id]);
    expect(await musicUrl(storage, MUSIC[0].id)).toBe(`https://signed.example/music/${MUSIC[0].id}.mp3`);
    expect(await musicUrl(storage, MUSIC[1].id)).toBeNull();
    expect(await musicUrl(storage, 'nope')).toBeNull();
  });

  it('accepts a volume from 0 to 100 and nothing else', () => {
    expect(updateVideoSchema.safeParse({ version: 1, musicId: 'x', musicVolume: 35 }).success).toBe(true);
    expect(updateVideoSchema.safeParse({ version: 1, musicVolume: 101 }).success).toBe(false);
    expect(updateVideoSchema.safeParse({ version: 1, musicVolume: 0.5 }).success).toBe(false);
  });
});
