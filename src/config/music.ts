/**
 * Background music offered in the app. Two tracks are from Pixabay (Pixabay Content Licence: free for
 * commercial use, no attribution required); the rest are by Kevin MacLeod (incompetech.com, CC BY 4.0: free
 * for commercial use, but the credit line in `credit` must be shown where the video is posted). The MP3s live
 * in R2 at `music/<id>.mp3`; `npm run upload:music` copies them there from `assets/music/<file>` and records
 * the licence in the `assets` collection. A track that was never uploaded is simply not offered.
 */
export type MusicTrack = {
  id: string; name: string; blurb: string; file: string; author: string; pageUrl: string;
  source?: 'pixabay' | 'incompetech'; licence?: string; credit?: string;
};

export const MUSIC_LICENCE = 'Pixabay Content Licence (https://pixabay.com/service/license-summary/)';
export const CC_BY_LICENCE = 'Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)';

const macleod = (id: string, name: string, blurb: string, download: string): MusicTrack => ({
  id, name, blurb, file: `${id}.mp3`, author: 'Kevin MacLeod', source: 'incompetech', licence: CC_BY_LICENCE,
  pageUrl: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(download)}.mp3`,
  credit: `Music: "${name}" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0`,
});

export const MUSIC: MusicTrack[] = [
  {
    id: 'healing-piano', name: 'Healing Piano', blurb: 'Ambient piano, very gentle', file: 'healing-piano.mp3', author: 'saavane',
    pageUrl: 'https://pixabay.com/music/ambient-healing-ambient-piano-background-track-170097/',
  },
  {
    id: 'ambient-focus', name: 'Ambient Focus', blurb: 'Minimal ambient, steady pulse', file: 'ambient-focus.mp3', author: 'NastelBom',
    pageUrl: 'https://pixabay.com/music/ambient-ambient-background-495888/',
  },
  macleod('dreamy-flashback', 'Dreamy Flashback', 'Soft and dreamy, for calm explainers', 'Dreamy Flashback'),
  macleod('airport-lounge', 'Airport Lounge', 'Smooth and relaxed, easy listening', 'Airport Lounge'),
  macleod('easy-lemon', 'Easy Lemon', 'Light and friendly, gentle groove', 'Easy Lemon'),
  macleod('wallpaper', 'Wallpaper', 'Bright and light, for tips and how-tos', 'Wallpaper'),
  macleod('carefree', 'Carefree', 'Upbeat and cheerful, good for work and career topics', 'Carefree'),
  macleod('local-forecast', 'Local Forecast', 'Warm and steady, classic explainer feel', 'Local Forecast - Elevator'),
];

export const findTrack = (id: string) => MUSIC.find((t) => t.id === id);

/** Slider value (percent) used while the narrator speaks; the music is louder in the pauses. */
export const DEFAULT_MUSIC_VOLUME = 35;
