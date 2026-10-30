import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { llmSceneSchema, llmStoryboardSchema, type LlmScene, type LlmStoryboard, type Scene } from '@/lib/schemas/storyboard';
import type { LlmProvider } from '@/server/providers';
import { LlmError } from './gemini';
import { anglesPrompt, ideasPrompt, safetyPrompt, scenePrompt, storyboardPrompt, WORDS_PER_SEC, type StoryboardInput } from './prompts';

export const MAX_SCENES = 12;
/** Beyond this share over the target length the storyboard is rejected and rewritten; below it only a warning is shown. */
const HARD_OVERRUN = 1.25;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const newSceneId = () => `sc_${randomBytes(4).toString('hex')}`;

/** Estimated spoken length of the scenes (System-Design 7: words / 2.3 per second). */
export const estimateSec = (scenes: { narration: string }[]) =>
  Math.round(scenes.reduce((n, s) => n + wordCount(s.narration), 0) / WORDS_PER_SEC);

/** Fixes the common slip of a cue that is a heading instead of spoken words, then puts elements in spoken order. */
export function repairScene(s: LlmScene): LlmScene {
  const words = s.narration.split(/\s+/).filter(Boolean);
  const text = ` ${norm(s.narration)} `;
  const at = (cue: string) => text.indexOf(` ${norm(cue)} `);
  const elements = s.elements.map((el, k) => {
    if (at(el.cue) >= 0) return el;
    // The first narration word the element's own words point at (for example a heading "Axial Tilt" -> "tilt").
    const wanted = new Set(norm(`${el.cue} ${el.text}`).split(' ').filter((w) => w.length > 3));
    const hit = words.findIndex((w) => wanted.has(norm(w)));
    // Still nothing in the narration (the model cued a word it never says): spread such elements over the narration in list order.
    const spread = Math.min(words.length - 1, Math.floor((k / Math.max(1, s.elements.length)) * words.length));
    const from = hit < 0 ? spread : hit;
    return { ...el, cue: words.slice(from, from + 2).join(' ') };
  });
  const ordered = elements.every((e) => at(e.cue) >= 0)
    ? [...elements].sort((a, b) => at(a.cue) - at(b.cue))
    : elements;
  return { ...s, elements: ordered };
}

/** Problems with one scene: a cue that is not in the narration, or cues that are out of spoken order. */
export function sceneProblems(s: LlmScene, label: string): string[] {
  const text = ` ${norm(s.narration)} `;
  const errs: string[] = [];
  let last = -1;
  for (const el of s.elements) {
    const at = text.indexOf(` ${norm(el.cue)} `);
    if (at < 0) { errs.push(`${label}: the cue "${el.cue}" must be copied exactly from the narration of that scene`); continue; }
    if (at < last) errs.push(`${label}: the cue "${el.cue}" is spoken before the previous element's cue; list elements in spoken order`);
    last = Math.max(last, at);
  }
  if (wordCount(s.narration) > 70) errs.push(`${label}: narration is over 70 words; split it or shorten it`);
  return errs;
}

/** Checks a whole storyboard: scene limits, cues and total length. */
export function storyboardProblems(sb: LlmStoryboard, lengthSec: number): string[] {
  const errs = sb.scenes.flatMap((s, k) => sceneProblems(s, `Scene ${k + 1}`));
  if (sb.scenes.length < 3) errs.push('Use at least 3 scenes');
  const total = sb.scenes.reduce((n, s) => n + wordCount(s.narration), 0);
  const target = lengthSec * WORDS_PER_SEC;
  if (total > target * HARD_OVERRUN) errs.push(`The narration has ${total} words but about ${Math.round(target)} fit in ${lengthSec} seconds; shorten it`);
  if (total < target * 0.6) errs.push(`The narration has only ${total} words; write about ${Math.round(target)} words for ${lengthSec} seconds`);
  return errs;
}

export const toScene = (s: LlmScene, order: number, id = newSceneId()): Scene => ({
  id, order, template: s.template, ...(s.template === 'diagram' ? { diagram: s.diagram ?? 'flow' } : {}), title: s.title,
  ...(s.template === 'stock-clip' ? { media: { query: (s.mediaQuery || s.title || 'nature').trim() } } : {}), narration: s.narration.trim(),
  needsCheck: s.needsCheck, ...(s.needsCheck && s.checkNote ? { checkNote: s.checkNote } : {}),
  elements: s.elements.map((e, n) => ({ id: `el_${n + 1}`, type: e.type, text: e.text.trim(), cue: e.cue.trim(), ...(e.icon ? { icon: e.icon } : {}) })),
});

/** Asks the model, and on a bad answer asks once more with the problems listed (Implementation-Steps 2.7). */
async function withRetry<T>(ask: (errors: string[]) => Promise<T>, check: (v: T) => string[]): Promise<T> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = await ask(errors);
      errors = check(value);
      if (!errors.length) return value;
    } catch (e) {
      if (!(e instanceof LlmError) || e.kind === 'unavailable') throw e;
      errors = [e.message];
    }
  }
  throw new AppError('STORYBOARD_FAILED', 'We could not write the script. Try again.', 422, undefined, { problems: errors });
}

export async function generateStoryboard(llm: LlmProvider, input: StoryboardInput) {
  const sb = await withRetry(
    async (errs) => {
      const raw = await llm.generate(storyboardPrompt(input, errs), llmStoryboardSchema);
      return { ...raw, scenes: raw.scenes.map(repairScene) };
    },
    (v) => storyboardProblems(v, input.lengthSec),
  );
  return { ...sb, scenes: sb.scenes.map((s, k) => toScene(s, k)) };
}

/** New content for one scene; the caller keeps its id and position. */
export async function regenerateScene(
  llm: LlmProvider, input: StoryboardInput, scene: Scene, others: string[], instruction?: string,
) {
  const out = await withRetry(
    async (errs) => repairScene(await llm.generate(scenePrompt(input, scene, others, instruction, errs), llmSceneSchema)),
    (v) => sceneProblems(v, 'This scene'),
  );
  return toScene(out, scene.order, scene.id);
}

const safetySchema = z.object({ safe: z.boolean(), reason: z.string().optional() });

/** Throws UNSAFE_TOPIC when the model says the topic is not fine for a classroom video. */
export async function assertSafeTopic(llm: LlmProvider, topic: string) {
  const res = await llm.generate(safetyPrompt(topic), safetySchema);
  if (!res.safe) throw new AppError('UNSAFE_TOPIC', 'We cannot make a video about that topic. Try a different topic.', 422);
}

const ideasSchema = z.object({ ideas: z.array(z.object({ topic: z.string().min(3).max(200), hint: z.string().max(60).default('') })).min(1).max(12) });
const anglesSchema = z.object({
  angles: z.array(z.object({ id: z.enum(['everyday', 'step', 'mistake']), label: z.string().max(40), hook: z.string().max(240) })).length(3),
});

export async function suggestIdeas(llm: LlmProvider, subject?: string, audience?: string) {
  const { ideas } = await llm.generate(ideasPrompt(subject, audience), ideasSchema);
  return ideas.slice(0, 6);
}

export async function suggestAngles(llm: LlmProvider, topic: string) {
  return (await llm.generate(anglesPrompt(topic), anglesSchema)).angles;
}
