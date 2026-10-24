import { describe, expect, it } from 'vitest';
import type { Scene } from '@/lib/schemas/storyboard';
import { findCue, syncScene, LEAD_IN_MS, TAIL_MS } from '@/server/sync';
import { groupWords, voiceIds } from '@/server/voice';

const align = (text: string, perChar = 0.1) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i * perChar),
  character_end_times_seconds: [...text].map((_, i) => (i + 1) * perChar),
});

describe('groupWords', () => {
  it('groups characters into words with first-start and last-end times', () => {
    const words = groupWords(align('Hi you.'));
    expect(words).toEqual([
      { word: 'Hi', startMs: 0, endMs: 200 },
      { word: 'you.', startMs: 300, endMs: 700 },
    ]);
  });
  it('ignores repeated spaces and newlines', () => {
    expect(groupWords(align('a  b\nc')).map((w) => w.word)).toEqual(['a', 'b', 'c']);
  });
});

describe('voiceIds', () => {
  it('splits a comma-separated list and trims', () => {
    expect(voiceIds(' a1 , b2 ,')).toEqual(['a1', 'b2']);
    expect(voiceIds(undefined)).toEqual([]);
  });
});

const words = groupWords(align('Sunlight holds every colour. Air molecules scatter blue.'));
const scene = (cues: string[]): Scene => ({
  id: 's', order: 0, template: 'bullet-reveal', needsCheck: false, narration: '',
  elements: cues.map((cue, i) => ({ id: `e${i}`, type: 'bullet', text: cue, cue })),
});

describe('findCue', () => {
  it('finds exact multi-word cues, ignoring punctuation and case', () => {
    expect(findCue(words, 'Every Colour')).toBe(2);
  });
  it('tolerates one edit per word', () => {
    expect(findCue(words, 'molecule scatter')).toBe(5);
  });
  it('returns -1 when absent', () => {
    expect(findCue(words, 'volcano')).toBe(-1);
  });
});

describe('syncScene', () => {
  it('lands each element three frames before its cue word, on the voice clock', () => {
    const r = syncScene(scene(['sunlight', 'scatter']), words, 5000);
    const cueScatter = words[findCue(words, 'scatter')].startMs + LEAD_IN_MS;
    expect(r.elements[1].startMs).toBe(cueScatter - 100);
    expect(r.cueWordMs[1]).toBe(cueScatter);
    expect(r.durationMs).toBe(LEAD_IN_MS + 5000 + TAIL_MS);
    expect(r.warnings).toEqual([]);
  });
  it('clamps a late first element to appear within the first second', () => {
    const r = syncScene(scene(['blue']), words, 5000);
    expect(r.elements[0].startMs).toBe(1000);
  });
  it('leaves a first element that is already early on its cue', () => {
    const r = syncScene(scene(['sunlight']), words, 5000);
    expect(r.elements[0].startMs).toBe(LEAD_IN_MS - 100);
  });
  it('spaces unmatched cues evenly and warns', () => {
    const r = syncScene(scene(['sunlight', 'volcano']), words, 5000);
    expect(r.warnings[0]).toMatch(/volcano/);
    expect(r.cueWordMs[1]).toBeNull();
    expect(r.elements[1].startMs).toBeGreaterThan(r.elements[0].startMs);
  });
  it('sorts out-of-order cues and warns instead of failing', () => {
    const r = syncScene(scene(['blue', 'sunlight']), words, 5000);
    expect(r.elements.map((e) => e.id)).toEqual(['e1', 'e0']);
    expect(r.warnings.some((w) => /out of order/.test(w))).toBe(true);
  });
});
