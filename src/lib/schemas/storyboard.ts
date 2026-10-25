import { z } from 'zod';

export const TEMPLATES = [
  'title-hook', 'bullet-reveal', 'step-flow', 'diagram', 'definition-callout',
  'stat', 'comparison', 'timeline', 'formula', 'stock-clip', 'recap',
] as const;

/** Templates the renderer can draw today (src/remotion/templates). The storyboard prompt only offers these; Phase 3 widens it. */
export const ENABLED_TEMPLATES = [
  'title-hook', 'bullet-reveal', 'definition-callout', 'step-flow', 'stat', 'comparison', 'timeline', 'formula', 'diagram', 'recap',
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
  checkNote: z.string().optional(),
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

/** What the model returns for one scene (ids and order are added by the server). */
export const llmSceneSchema = z.object({
  template: z.enum(ENABLED_TEMPLATES),
  // The prompt shows "diagram":"" for scenes that are not diagrams, so an empty string counts as absent.
  diagram: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.enum(['flow', 'raindrop', 'orbit']).optional()),
  title: z.string().min(1).max(80).optional(),
  narration: z.string().min(1).max(600),
  needsCheck: z.boolean().default(false),
  checkNote: z.string().max(240).optional(),
  elements: z.array(z.object({
    type: z.string().min(1).max(30),
    text: z.string().min(1).max(120),
    cue: z.string().min(1).max(80),
  })).min(1).max(5),
});

/** What the model returns for a whole video. */
export const llmStoryboardSchema = z.object({
  title: z.string().min(1).max(100),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  caption: z.string().max(1500),
  hashtags: z.array(z.string().max(40)).max(10).default([]),
  scenes: z.array(llmSceneSchema).min(1).max(12),
});

export type LlmScene = z.infer<typeof llmSceneSchema>;
export type LlmStoryboard = z.infer<typeof llmStoryboardSchema>;
