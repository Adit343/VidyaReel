import { z } from 'zod';

export const TEMPLATES = [
  'title-hook', 'bullet-reveal', 'step-flow', 'diagram', 'definition-callout',
  'stat', 'comparison', 'timeline', 'formula', 'stock-clip', 'recap',
] as const;

export const wordSchema = z.object({ word: z.string(), startMs: z.number(), endMs: z.number() });

export const elementSchema = z.object({
  id: z.string(),
  type: z.string(),
  text: z.string(),
  cue: z.string(),
  startMs: z.number().optional(),
});

export const sceneSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  template: z.enum(TEMPLATES),
  diagram: z.enum(['flow', 'raindrop', 'orbit']).optional(),
  title: z.string().optional(),
  narration: z.string().min(1),
  needsCheck: z.boolean().default(false),
  elements: z.array(elementSchema),
  media: z.object({ assetId: z.string(), query: z.string() }).optional(),
  audio: z.object({
    key: z.string(), hash: z.string(), durationMs: z.number(), words: z.array(wordSchema),
  }).optional(),
  durationMs: z.number().optional(),
});

export const storyboardSchema = z.object({
  title: z.string(),
  language: z.string(),
  scenes: z.array(sceneSchema).min(1).max(12),
});

export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
