/**
 * Who a reel is for. The stored `audience` on a video is the free-text `value` below (max 40 characters), so
 * videos made before this list existed ("Class 7", "General") keep working. `group` drives the idea chips and
 * the tone guidance sent to the AI.
 */
export type AudienceGroup = 'school' | 'college' | 'work' | 'general';

export type Audience = { value: string; label: string; hint: string; group: AudienceGroup; guide: string };

export const AUDIENCES: readonly Audience[] = [
  { value: 'Class 5', label: 'Class 5', hint: 'School, ages 10-11', group: 'school', guide: 'Primary school children. Very simple words, short sentences, playful everyday examples.' },
  { value: 'Class 7', label: 'Class 7', hint: 'School, ages 12-13', group: 'school', guide: 'Middle school students. Simple words, concrete examples from home, sport and street life.' },
  { value: 'Class 9', label: 'Class 9', hint: 'School, ages 14-15', group: 'school', guide: 'Secondary school students. Introduce the proper terms, with a clear example for each.' },
  { value: 'College students', label: 'College students', hint: 'Undergraduate level', group: 'college', guide: 'Undergraduate students. Use correct technical terms, explain the reasoning behind them, and connect to real applications.' },
  { value: 'Exam aspirants', label: 'Exam aspirants', hint: 'JEE, NEET, UPSC, CAT, GATE and similar', group: 'college', guide: 'People preparing for competitive exams. Be exact and compact, stress the points that are asked in exams, and include a quick memory aid.' },
  { value: 'Working professionals', label: 'Working professionals', hint: 'Office, business and career skills', group: 'work', guide: 'Busy office professionals. Get to the point, no jargon without explanation, use workplace examples (meetings, email, deadlines, clients) and end with something they can do tomorrow.' },
  { value: 'Managers and leaders', label: 'Managers and leaders', hint: 'Team, strategy and people skills', group: 'work', guide: 'Managers and team leads. Focus on decisions, trade-offs and how to act with a team; use short realistic scenarios.' },
  { value: 'New hires', label: 'New hires', hint: 'Onboarding and training', group: 'work', guide: 'People new to a company or role. Assume no inside knowledge, explain each term once, and keep the tone welcoming and practical.' },
  { value: 'General', label: 'General public', hint: 'Anyone curious', group: 'general', guide: 'A general adult audience with no background in the topic. Plain words, one clear idea, a relatable example.' },
];

const BY_VALUE = new Map(AUDIENCES.map((a) => [a.value, a]));

/** Known audience, or undefined for older or custom values. */
export const findAudience = (value: string) => BY_VALUE.get(value);

export const audienceGroup = (value: string): AudienceGroup => BY_VALUE.get(value)?.group ?? (/^(class|grade)\b/i.test(value) ? 'school' : 'general');

/** One sentence telling the AI how to pitch the video. Unknown values are passed through as the audience's own description. */
export const audienceGuide = (value: string) => BY_VALUE.get(value)?.guide ?? `Pitch it for: ${value}.`;
