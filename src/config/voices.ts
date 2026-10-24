/**
 * Voices offered in the app. Library voices (for example the Indian-accent ones) need a paid ElevenLabs
 * plan through the API, so V1 ships ElevenLabs stock voices that were tested on the free plan
 * (docs/Phase-1-Spike-Results.md). Phase 3 (step 3.14) replaces this with a probed list.
 */
export type VoiceOption = { id: string; name: string; blurb: string };

export const VOICES: VoiceOption[] = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', blurb: 'British, clear educator' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', blurb: 'British, steady broadcaster' },
];
