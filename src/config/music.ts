/**
 * Background music offered in the app. Both tracks are from Pixabay (Pixabay Content Licence: free for
 * commercial use, no attribution required). The MP3s live in R2 at `music/<id>.mp3`; `npm run upload:music`
 * copies them there from `assets/music/<file>` and records the licence in the `assets` collection.
 */
export type MusicTrack = { id: string; name: string; blurb: string; file: string; author: string; pageUrl: string };

export const MUSIC_LICENCE = 'Pixabay Content Licence (https://pixabay.com/service/license-summary/)';

export const MUSIC: MusicTrack[] = [
  {
    id: 'healing-piano', name: 'Healing Piano', blurb: 'Ambient piano, very gentle', file: 'healing-piano.mp3', author: 'saavane',
    pageUrl: 'https://pixabay.com/music/ambient-healing-ambient-piano-background-track-170097/',
  },
  {
    id: 'ambient-focus', name: 'Ambient Focus', blurb: 'Minimal ambient, steady pulse', file: 'ambient-focus.mp3', author: 'NastelBom',
    pageUrl: 'https://pixabay.com/music/ambient-ambient-background-495888/',
  },
];

export const findTrack = (id: string) => MUSIC.find((t) => t.id === id);

/** Slider value (percent) used while the narrator speaks; the music is louder in the pauses. */
export const DEFAULT_MUSIC_VOLUME = 35;
