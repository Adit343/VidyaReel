import React from 'react';
import { Audio, useVideoConfig } from 'remotion';
import { musicGain, type Window } from './music';

/** Background music for the whole video, looped, ducked under the narrator and faded out at the end. */
export const MusicBed: React.FC<{ url: string; volume: number; windows: Window[] }> = ({ url, volume, windows }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalMs = (durationInFrames / fps) * 1000;
  return <Audio src={url} loop volume={(frame) => musicGain((frame / fps) * 1000, windows, { speech: volume, totalMs })} />;
};
