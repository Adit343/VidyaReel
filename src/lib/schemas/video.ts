import { z } from 'zod';

export const VIDEO_STATUSES = [
  'draft', 'storyboard_ready', 'rendering', 'ready', 'failed', 'scheduled', 'posted',
] as const;
export const videoStatusSchema = z.enum(VIDEO_STATUSES);
export type VideoStatus = z.infer<typeof videoStatusSchema>;

export const THEMES = ['forest', 'saffron', 'sage'] as const;
export const ANGLES = ['everyday', 'step', 'mistake'] as const;

export const createVideoSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  lengthSec: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
  language: z.string().default('en'),
  audience: z.string().trim().max(40).default('General'),
  angle: z.enum(ANGLES).optional(),
  voiceId: z.string().max(60).optional(),
}).strict();

export const updateVideoSchema = z.object({
  version: z.number().int(),
  title: z.string().trim().min(1).max(100).optional(),
  voiceId: z.string().max(60).optional(),
  speed: z.number().min(0.8).max(1.2).optional(),
  theme: z.enum(THEMES).optional(),
  musicId: z.string().max(60).nullable().optional(),
  /** Percent, the music level while the narrator speaks. */
  musicVolume: z.number().int().min(0).max(100).optional(),
  captionsOn: z.boolean().optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string().max(40)).max(15).optional(),
}).strict();

export const sceneEditSchema = z.object({
  version: z.number().int(),
  narration: z.string().trim().min(1).max(600).optional(),
  onScreenText: z.array(z.string().max(120)).max(5).optional(),
  title: z.string().max(80).optional(),
  moveTo: z.number().int().min(0).max(11).optional(),
}).strict();

export const versionOnlySchema = z.object({ version: z.number().int() }).strict();
export const sceneRegenerateSchema = z.object({ version: z.number().int(), instruction: z.string().trim().max(200).optional() }).strict();
export const sceneAddSchema = z.object({ version: z.number().int(), afterSceneId: z.string().optional() }).strict();

export const ideasSuggestSchema = z.object({ subject: z.string().trim().max(100).optional() }).strict();
export const ideasAnglesSchema = z.object({ topic: z.string().trim().min(1).max(500) }).strict();

export const postVideoSchema = z.object({
  caption: z.string().max(2200),
  scheduledAt: z.string().datetime().optional(),
}).strict();
