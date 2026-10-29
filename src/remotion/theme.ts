import React from 'react';
import { loadFont as loadHeadline } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadBody } from '@remotion/google-fonts/HankenGrotesk';

// Loading registers the font and makes Remotion wait for it before each frame renders.
const headline = loadHeadline('normal', { weights: ['800'], subsets: ['latin'] });
const body = loadBody('normal', { weights: ['400', '600'], subsets: ['latin'] });

export type ThemeName = 'forest' | 'saffron' | 'sage' | 'chalkboard' | 'blackboard' | 'slate' | 'rose' | 'ocean';

export type Theme = {
  canvas: string; surface: string; ink: string; muted: string;
  /** Strong brand colour: hook backgrounds, headings, shapes. */
  primary: string;
  /** Text colour on a `primary` background. */
  onPrimary: string;
  /** Softer text colour on a `primary` background. */
  onPrimaryMuted: string;
  /** Small highlight: dots, bars, underlines. */
  spark: string;
  /** Caption pill. */
  captionBg: string; captionInk: string;
  fontHeadline: string; fontBody: string;
};

const fonts = { fontHeadline: headline.fontFamily, fontBody: body.fontFamily };

export const THEMES: Record<ThemeName, Theme> = {
  forest: {
    canvas: '#EEF1EC', surface: '#FFFFFF', ink: '#0F2A20', muted: '#54675D',
    primary: '#145A41', onPrimary: '#FFFFFF', onPrimaryMuted: '#D7E8DF', spark: '#FF9F1C',
    captionBg: '#0F2A20', captionInk: '#FFFFFF', ...fonts,
  },
  saffron: {
    canvas: '#FFF6E5', surface: '#FFFFFF', ink: '#3A2200', muted: '#7A5A2E',
    primary: '#B36B00', onPrimary: '#FFFFFF', onPrimaryMuted: '#FFE7BF', spark: '#145A41',
    captionBg: '#3A2200', captionInk: '#FFFFFF', ...fonts,
  },
  sage: {
    canvas: '#0F2A20', surface: '#1B3A2E', ink: '#EEF1EC', muted: '#A8BDB1',
    primary: '#92D4B4', onPrimary: '#0F2A20', onPrimaryMuted: '#1B3A2E', spark: '#FF9F1C',
    captionBg: '#EEF1EC', captionInk: '#0F2A20', ...fonts,
  },
  // Chalk on a board: pale ink on a dark canvas, the strong colour is a chalk stick.
  chalkboard: {
    canvas: '#2F4F43', surface: '#3C6152', ink: '#F4F1E8', muted: '#BBCDC2',
    primary: '#F7E7A1', onPrimary: '#2F4F43', onPrimaryMuted: '#3C6152', spark: '#F4A6A0',
    captionBg: '#F4F1E8', captionInk: '#2F4F43', ...fonts,
  },
  blackboard: {
    canvas: '#1E1F21', surface: '#2D2F33', ink: '#F2F2EE', muted: '#A9ABAE',
    primary: '#9ED8F5', onPrimary: '#1E1F21', onPrimaryMuted: '#2D2F33', spark: '#FFD166',
    captionBg: '#F2F2EE', captionInk: '#1E1F21', ...fonts,
  },
  slate: {
    canvas: '#1F2F46', surface: '#2B405F', ink: '#F3F1EA', muted: '#B0C1D7',
    primary: '#FFB4A2', onPrimary: '#1F2F46', onPrimaryMuted: '#2B405F', spark: '#B5E48C',
    captionBg: '#F3F1EA', captionInk: '#1F2F46', ...fonts,
  },
  rose: {
    canvas: '#FDF0F2', surface: '#FFFFFF', ink: '#3B1520', muted: '#835563',
    primary: '#B3305A', onPrimary: '#FFFFFF', onPrimaryMuted: '#FAD3DE', spark: '#2A9D8F',
    captionBg: '#3B1520', captionInk: '#FFFFFF', ...fonts,
  },
  ocean: {
    canvas: '#EAF4F8', surface: '#FFFFFF', ink: '#0B2A3A', muted: '#4F6F80',
    primary: '#0E6E95', onPrimary: '#FFFFFF', onPrimaryMuted: '#CFE8F2', spark: '#FF8C42',
    captionBg: '#0B2A3A', captionInk: '#FFFFFF', ...fonts,
  },
};

export const ThemeContext = React.createContext<Theme>(THEMES.forest);
export const useTheme = () => React.useContext(ThemeContext);

/** Unknown or missing names fall back to the default theme, so old videos still render. */
export const themeFor = (name?: string): Theme => THEMES[name as ThemeName] ?? THEMES.forest;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
