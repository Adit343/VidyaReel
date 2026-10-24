import { loadFont as loadHeadline } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadBody } from '@remotion/google-fonts/HankenGrotesk';

// Loading registers the font and makes Remotion wait for it before each frame renders.
const headline = loadHeadline('normal', { weights: ['800'], subsets: ['latin'] });
const body = loadBody('normal', { weights: ['400', '600'], subsets: ['latin'] });

export const theme = {
  canvas: '#EEF1EC', surface: '#FFFFFF', ink: '#0F2A20', muted: '#54675D',
  primary: '#145A41', spark: '#FF9F1C',
  fontHeadline: headline.fontFamily, fontBody: body.fontFamily,
};
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
