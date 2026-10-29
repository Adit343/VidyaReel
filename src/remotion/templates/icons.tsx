import React from 'react';
import { ICON_NAMES } from './iconNames';

/**
 * Small line icons the storyboard model can pick by name. They are drawn here (not emoji) so they look the same
 * on every machine, including the render sandbox, which has no emoji font. Each is a 48x48 drawing.
 */
const PATHS: Record<string, React.ReactNode> = {
  sun: <><circle cx="24" cy="24" r="8" /><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4" /></>,
  moon: <path d="M36 28A14 14 0 0 1 20 12a14 14 0 1 0 16 16z" />,
  cloud: <path d="M14 34a8 8 0 0 1 0-16 11 11 0 0 1 21 3 7 7 0 0 1 0 13z" />,
  rain: <><path d="M14 28a8 8 0 0 1 0-14 11 11 0 0 1 21 3 7 7 0 0 1 0 11z" /><path d="M16 34l-3 8M26 34l-3 8M36 34l-3 8" /></>,
  drop: <path d="M24 5C16 16 11 22 11 30a13 13 0 0 0 26 0C37 22 32 16 24 5z" />,
  wave: <path d="M4 18c5-6 10-6 15 0s10 6 15 0 8-4 10-2M4 30c5-6 10-6 15 0s10 6 15 0 8-4 10-2" />,
  fire: <path d="M24 4c2 8 10 12 10 22a10 10 0 0 1-20 0c0-5 3-7 4-11 3 2 4 4 4 6 2-5 2-10 2-17z" />,
  bolt: <path d="M28 4L10 28h12l-2 16 18-24H26z" />,
  leaf: <><path d="M10 38C8 20 20 8 40 8c0 20-10 32-28 30z" /><path d="M10 38C18 28 24 22 32 16" /></>,
  plant: <><path d="M24 44V20" /><path d="M24 28c-10 0-14-6-14-14 10 0 14 6 14 14zM24 22c0-8 5-12 14-12 0 8-5 12-14 12z" /></>,
  tree: <><circle cx="24" cy="18" r="13" /><path d="M24 31v13M24 38l-6-6M24 36l6-6" /></>,
  mountain: <path d="M2 40L18 12l8 14 6-8 14 22z" />,
  globe: <><circle cx="24" cy="24" r="19" /><path d="M5 24h38M24 5c-9 9-9 29 0 38M24 5c9 9 9 29 0 38" /></>,
  atom: <><circle cx="24" cy="24" r="3" /><ellipse cx="24" cy="24" rx="20" ry="8" /><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(60 24 24)" /><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(120 24 24)" /></>,
  flask: <><path d="M18 4h12M20 4v14L7 40a3 3 0 0 0 3 4h28a3 3 0 0 0 3-4L28 18V4" /><path d="M13 32h22" /></>,
  magnet: <path d="M10 6v18a14 14 0 0 0 28 0V6h-9v18a5 5 0 0 1-10 0V6zM10 14h9M29 14h9" />,
  heart: <path d="M24 42S5 30 5 17a10 10 0 0 1 19-4 10 10 0 0 1 19 4c0 13-19 25-19 25z" />,
  lungs: <><path d="M24 6v18M24 24c-2 4-4 4-6 4M24 24c2 4 4 4 6 4" /><path d="M20 14c-8 0-14 14-14 26 0 3 4 3 8 0 3-2 6-6 6-12zM28 14c8 0 14 14 14 26 0 3-4 3-8 0-3-2-6-6-6-12z" /></>,
  brain: <path d="M17 8a7 7 0 0 0-7 8 7 7 0 0 0-2 12 7 7 0 0 0 9 9 7 7 0 0 0 7 3V8a7 7 0 0 0-7 0zM31 8a7 7 0 0 1 7 8 7 7 0 0 1 2 12 7 7 0 0 1-9 9 7 7 0 0 1-7 3V8a7 7 0 0 1 7 0z" />,
  cell: <><ellipse cx="24" cy="24" rx="20" ry="16" /><circle cx="24" cy="24" r="6" /><circle cx="12" cy="22" r="2" /><circle cx="36" cy="28" r="2" /><circle cx="30" cy="14" r="1.5" /></>,
  dna: <><path d="M14 4c0 12 20 12 20 20S14 36 14 44M34 4c0 12-20 12-20 20s20 12 20 20" /><path d="M17 12h14M17 36h14M15 24h18" /></>,
  person: <><circle cx="24" cy="13" r="8" /><path d="M8 44c0-10 7-16 16-16s16 6 16 16" /></>,
  people: <><circle cx="17" cy="14" r="6" /><circle cx="33" cy="16" r="5" /><path d="M4 42c0-8 5-13 13-13s13 5 13 13M30 30c7-1 14 3 14 12" /></>,
  book: <><path d="M6 8c7-2 13-1 18 3 5-4 11-5 18-3v30c-7-2-13-1-18 3-5-4-11-5-18-3z" /><path d="M24 11v30" /></>,
  bulb: <><path d="M16 32c0-4-6-7-6-14a14 14 0 0 1 28 0c0 7-6 10-6 14z" /><path d="M17 38h14M19 44h10" /></>,
  gear: <><circle cx="24" cy="24" r="7" /><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M10 38l5-5M33 15l5-5" /></>,
  clock: <><circle cx="24" cy="24" r="19" /><path d="M24 12v13l9 6" /></>,
  thermometer: <><path d="M20 28V8a4 4 0 0 1 8 0v20a9 9 0 1 1-8 0z" /><path d="M24 14v22" /></>,
  scale: <><path d="M24 6v34M12 40h24M8 14h32" /><path d="M8 14l-5 14h10zM40 14l-5 14h10z" /></>,
  coin: <><circle cx="24" cy="24" r="19" /><path d="M24 12v24M30 17c-4-4-12-2-12 3s12 3 12 9-8 7-12 3" /></>,
  house: <path d="M5 24L24 7l19 17M10 20v22h28V20M20 42V30h8v12" />,
  factory: <path d="M4 42V22l12 8V22l12 8V22l12 8V6h4v36zM12 38h4M22 38h4M32 38h4" />,
  car: <><path d="M5 30l4-12a4 4 0 0 1 4-3h22a4 4 0 0 1 4 3l4 12v8H5z" /><circle cx="14" cy="38" r="4" /><circle cx="34" cy="38" r="4" /></>,
  flag: <path d="M10 44V6M10 8h26l-6 9 6 9H10" />,
  star: <path d="M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z" />,
  question: <><circle cx="24" cy="24" r="19" /><path d="M17 19c0-4 3-6 7-6s7 2 7 6c0 5-7 5-7 10M24 35v2" /></>,
  check: <><circle cx="24" cy="24" r="19" /><path d="M14 25l7 7 14-15" /></>,
  cross: <><circle cx="24" cy="24" r="19" /><path d="M16 16l16 16M32 16L16 32" /></>,
  arrow: <path d="M6 24h34M28 10l14 14-14 14" />,
  magnify: <><circle cx="20" cy="20" r="14" /><path d="M31 31l13 13" /></>,
  rocket: <><path d="M24 4c8 6 10 16 8 28H16C14 20 16 10 24 4z" /><circle cx="24" cy="18" r="4" /><path d="M16 26l-8 10 8-2M32 26l8 10-8-2M20 40l4 6 4-6" /></>,
  wind: <path d="M4 18h24a6 6 0 1 0-6-6M4 30h32a6 6 0 1 1-6 6M4 24h16" />,
  snow: <path d="M24 4v40M7 14l34 20M41 14L7 34M18 8l6 5 6-5M18 40l6-5 6 5" />,
};

/** True when `name` is one of the drawn icons (the model sometimes invents names). */
export const hasIcon = (name?: string): name is string => !!name && (ICON_NAMES as readonly string[]).includes(name) && name in PATHS;

export const Icon: React.FC<{ name?: string; size: number; color: string; strokeWidth?: number }> = ({ name, size, color, strokeWidth = 3 }) => {
  if (!hasIcon(name)) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
};
