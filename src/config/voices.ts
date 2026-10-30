/**
 * Voices offered in the app. Library voices (for example the Indian-accent ones) need a paid ElevenLabs
 * plan through the API, so V1 ships ElevenLabs stock voices. All nine were tested on the free plan (2026-10-30, a short
 * text-to-speech call each); the Indian-accent library voices return 402 there. Phase 3 (step 3.14) replaces this with a probed list.
 */
export type VoiceOption = { id: string; name: string; blurb: string };

export const VOICES: VoiceOption[] = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', blurb: 'British woman, clear educator' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', blurb: 'British man, steady broadcaster' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', blurb: 'American woman, knowledgeable and professional' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella', blurb: 'American woman, bright and warm' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', blurb: 'British woman, velvety and confident' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', blurb: 'American man, smooth and trustworthy' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', blurb: 'American man, charming and down-to-earth' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', blurb: 'British man, warm storyteller' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', blurb: 'Neutral American, relaxed and informative' },
];
