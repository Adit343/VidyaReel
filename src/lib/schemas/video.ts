import { z } from 'zod';

export const VIDEO_STATUSES = [
  'draft', 'storyboard_ready', 'rendering', 'ready', 'failed', 'scheduled', 'posted',
] as const;
export const videoStatusSchema = z.enum(VIDEO_STATUSES);
export type VideoStatus = z.infer<typeof videoStatusSchema>;

export const createVideoSchema = z.object({
  topic: z.string().min(3).max(200),
  lengthSec: z.number().int().min(30).max(90).default(60),
  language: z.string().default('en-IN'),
  audience: z.string().optional(),
}).strict();

export const updateVideoSchema = z.object({
  version: z.number().int(),
  voiceId: z.string().optional(),
  speed: z.number().min(0.8).max(1.2).optional(),
  theme: z.string().optional(),
  musicId: z.string().optional(),
  captionsOn: z.boolean().optional(),
  caption: z.string().max(2200).optional(),
}).strict();

export const postVideoSchema = z.object({
  caption: z.string().max(2200),
  scheduledAt: z.string().datetime().optional(),
}).strict();
