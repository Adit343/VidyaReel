import { ObjectId } from 'mongodb';
import { afterEach, describe, expect, it } from 'vitest';
import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from '@/lib/errors';
import { setLlm } from '@/server/ai';
import { answerText, createGeminiProvider, LlmError } from '@/server/ai/gemini';
import { limitLlm } from '@/server/ai/limit';
import { repairScene, sceneProblems, storyboardProblems } from '@/server/ai/storyboard';
import { approvedEmails, users, videos } from '@/server/db/collections';
import { getQuota } from '@/server/quota';
import type { LlmProvider, Prompt } from '@/server/providers';
import {
  addScene, createVideo, deleteScene, editScene, getVideo, regenerateOneScene, regenerateVideo, updateVideo,
} from '@/server/videos/service';
import { approve } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);

const goodScene = (n: number) => ({
  template: n === 0 ? 'title-hook' : 'bullet-reveal', title: `Scene ${n + 1}`, needsCheck: n === 1, checkNote: n === 1 ? 'Check the angle' : undefined,
  narration: `Earth is tilted as it goes around the Sun in scene ${n + 1}, and that tilt changes how much sunlight each place on the planet receives across the whole year.`,
  elements: [{ type: 'bullet', text: 'Tilt matters', cue: 'Earth is tilted' }, { type: 'bullet', text: 'Orbit', cue: 'around the Sun' }],
});
const goodBoard = (scenes = 4) => ({
  title: 'Why seasons happen', accent: '#145A41', caption: 'Seasons explained. Did you know?', hashtags: ['science', '#seasons'],
  scenes: Array.from({ length: scenes }, (_, n) => goodScene(n)),
});

/** A model stub: `answers` are consumed in order; a function answer can throw. */
function fakeLlm(answers: unknown[]): LlmProvider & { prompts: Prompt[] } {
  const prompts: Prompt[] = [];
  return {
    prompts,
    async generate<T>(prompt: Prompt, schema: ZodType<T, ZodTypeDef, unknown>) {
      prompts.push(prompt);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      const parsed = schema.safeParse(next);
      if (!parsed.success) throw new LlmError('invalid', `The answer did not match the format (${parsed.error.issues[0]?.path.join('.')})`);
      return parsed.data;
    },
  };
}
const safe = { safe: true };

async function member(email = 'm@example.com') {
  await approve(email);
  const _id = new ObjectId();
  await users().insertOne({ _id, email, name: 'M', timeZone: 'Asia/Kolkata', createdAt: new Date(), updatedAt: new Date() });
  return { id: _id, email };
}
const input = { topic: 'Why do we have seasons?', lengthSec: 60 as const, language: 'en', audience: 'Class 7' };

afterEach(() => setLlm(undefined));

describe('storyboard validation', () => {
  it('accepts cues that appear in the narration in spoken order', () => {
    expect(storyboardProblems(goodBoard(4) as never, 60)).toEqual([]);
  });
  it('flags a cue that is not in the narration', () => {
    const s = { ...goodScene(0), elements: [{ type: 'title', text: 'x', cue: 'moon phases' }] };
    expect(sceneProblems(s as never, 'Scene 1')[0]).toMatch(/moon phases/);
  });
  it('repairs a heading used as a cue and puts elements in spoken order', () => {
    const s = { ...goodScene(0), elements: [{ type: 'a', text: 'Sun', cue: 'around the Sun' }, { type: 'b', text: 'Tilted Earth', cue: 'Axial heading' }] };
    const fixed = repairScene(s as never);
    expect(fixed.elements.map((e) => e.cue)).toEqual(['Earth is', 'around the Sun']);
    expect(sceneProblems(fixed, 'S')).toEqual([]);
  });
  it('flags cues listed out of spoken order', () => {
    const s = { ...goodScene(0), elements: [{ type: 'a', text: 'x', cue: 'around the Sun' }, { type: 'b', text: 'y', cue: 'Earth is tilted' }] };
    expect(sceneProblems(s as never, 'Scene 1').join()).toMatch(/spoken order/);
  });
  it('rejects narration far over the chosen length but only warns when slightly over', () => {
    const long = goodBoard(4);
    long.scenes.forEach((s) => { s.narration = `${'word '.repeat(60)}Earth is tilted around the Sun`; });
    expect(storyboardProblems(long as never, 60).join()).toMatch(/shorten/);
  });
  it('reads a Gemini answer without thought parts or a code fence', () => {
    const text = answerText({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '```json\n{"a":1}\n```' }] } }] });
    expect(JSON.parse(text)).toEqual({ a: 1 });
  });
});

describe('Gemini provider', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const ok = (obj: unknown) => reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
  const schema = { safeParse: (v: unknown) => ({ success: true as const, data: v }) } as unknown as ZodType<unknown, ZodTypeDef, unknown>;

  it('retries once after a provider 429, then succeeds', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const calls: number[] = [];
    const fetchImpl = (async () => { calls.push(1); return calls.length === 1 ? reply({ error: { message: 'slow down' } }, 429) : ok({ a: 1 }); }) as unknown as typeof fetch;
    expect(await createGeminiProvider(fetchImpl, 1).generate({ system: '', user: '' }, schema)).toEqual({ a: 1 });
    expect(calls).toHaveLength(2);
  });
  it('reports unavailable after two 429s, and invalid for non-JSON', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const busy = (async () => reply({ error: { message: 'quota' } }, 429)) as unknown as typeof fetch;
    await expect(createGeminiProvider(busy, 1).generate({ system: '', user: '' }, schema)).rejects.toMatchObject({ kind: 'unavailable' });
    const junk = (async () => reply({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })) as unknown as typeof fetch;
    await expect(createGeminiProvider(junk, 1).generate({ system: '', user: '' }, schema)).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('creating a video', () => {
  it('writes a storyboard, counts toward the daily cap and returns the view', async () => {
    const owner = await member();
    setLlm(fakeLlm([safe, goodBoard(4)]));
    const v = await createVideo(owner, input as never);
    expect(v.status).toBe('storyboard_ready');
    expect(v.scenes).toHaveLength(4);
    expect(v.scenes[1]).toMatchObject({ needsCheck: true, checkNote: 'Check the angle', order: 1 });
    expect(v.scenes[0].onScreenText).toEqual(['Tilt matters', 'Orbit']);
    expect(v.hashtags).toEqual(['#science', '#seasons']);
    expect(v.version).toBe(2);
    expect(JSON.stringify(v)).not.toContain('"audio"');
    expect((await getQuota(owner.id, owner.email)).used).toBe(1);
  });

  it('refuses an unsafe topic without creating a video', async () => {
    const owner = await member();
    setLlm(fakeLlm([{ safe: false, reason: 'weapons' }]));
    expect(await code(createVideo(owner, input as never))).toBe('UNSAFE_TOPIC');
    expect(await videos().countDocuments()).toBe(0);
  });

  it('stops at the daily limit before calling the model', async () => {
    const owner = await member();
    await approvedEmails().updateOne({ email: owner.email }, { $set: { dailyLimit: 1 } });
    const llm = fakeLlm([safe, goodBoard(), safe, goodBoard()]);
    setLlm(llm);
    await createVideo(owner, input as never);
    const calls = llm.prompts.length;
    expect(await code(createVideo(owner, input as never))).toBe('DAILY_LIMIT');
    expect(llm.prompts).toHaveLength(calls);
  });

  it('retries a bad storyboard once with the problems listed, then succeeds', async () => {
    const owner = await member();
    const bad = goodBoard(4);
    bad.scenes[0].elements[0] = { type: 'bullet', text: 'Zebra', cue: 'not in the narration' };
    const llm = fakeLlm([safe, bad, goodBoard(4)]);
    setLlm(llm);
    const v = await createVideo(owner, input as never);
    expect(v.status).toBe('storyboard_ready');
    expect(llm.prompts[2].user).toContain('not in the narration');
  });

  it('fails cleanly after the retry: draft marked failed, refunded, details carry the video id', async () => {
    const owner = await member();
    const bad = goodBoard(4);
    bad.scenes[0].elements[0] = { type: 'bullet', text: 'Zebra', cue: 'nope' };
    setLlm(fakeLlm([safe, bad, bad]));
    const err = (await createVideo(owner, input as never).catch((e) => e)) as AppError;
    expect(err).toMatchObject({ code: 'STORYBOARD_FAILED', status: 422 });
    const row = await videos().findOne({ _id: new ObjectId(String(err.details?.videoId)) });
    expect(row?.status).toBe('failed');
    expect((await getQuota(owner.id, owner.email)).used).toBe(0);
  });

  it('reports a provider outage as PROVIDER_UNAVAILABLE and keeps the draft for Try again', async () => {
    const owner = await member();
    setLlm(fakeLlm([safe, new LlmError('unavailable', 'down')]));
    const err = (await createVideo(owner, input as never).catch((e) => e)) as AppError;
    expect(err).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 503 });
    expect(err.details?.videoId).toBeTruthy();
  });

  it('revives a failed video with regenerate and counts it again', async () => {
    const owner = await member();
    setLlm(fakeLlm([safe, new LlmError('unavailable', 'down')]));
    const err = (await createVideo(owner, input as never).catch((e) => e)) as AppError;
    setLlm(fakeLlm([goodBoard(4)]));
    const v = await regenerateVideo(owner, String(err.details?.videoId), Number(err.details?.version));
    expect(v.status).toBe('storyboard_ready');
    expect(v.failureReason).toBeNull();
    expect((await getQuota(owner.id, owner.email)).used).toBe(1);
  });
});

describe('editing a storyboard', () => {
  async function fresh() {
    const owner = await member();
    setLlm(fakeLlm([safe, goodBoard(4)]));
    return { owner, v: await createVideo(owner, input as never) };
  }

  it('stale versions get VERSION_CONFLICT; saves bump the version', async () => {
    const { owner, v } = await fresh();
    const a = await updateVideo(owner.id, v.id, { version: v.version, title: 'New title' });
    expect(a).toMatchObject({ title: 'New title', version: v.version + 1 });
    expect(await code(updateVideo(owner.id, v.id, { version: v.version, title: 'Again' }))).toBe('VERSION_CONFLICT');
  });

  it('other members get 404 and cannot edit', async () => {
    const { v } = await fresh();
    const other = await member('o@example.com');
    expect(await code(getVideo(other.id, v.id))).toBe('NOT_FOUND');
    expect(await code(updateVideo(other.id, v.id, { version: v.version, title: 'x' }))).toBe('NOT_FOUND');
    expect(await code(getVideo(other.id, 'not-an-id'))).toBe('NOT_FOUND');
  });

  it('rejects edits while rendering', async () => {
    const { owner, v } = await fresh();
    await videos().updateOne({ _id: new ObjectId(v.id) }, { $set: { status: 'rendering' } });
    expect(await code(updateVideo(owner.id, v.id, { version: v.version, theme: 'saffron' }))).toBe('VIDEO_LOCKED');
  });

  it('editing narration recomputes length and clears stale audio', async () => {
    const { owner, v } = await fresh();
    await videos().updateOne({ _id: new ObjectId(v.id) }, { $set: { 'scenes.0.audio': { key: 'k', hash: 'h', durationMs: 1, words: [] }, 'scenes.0.durationMs': 500 } });
    const before = await getVideo(owner.id, v.id);
    const out = await editScene(owner.id, v.id, v.scenes[0].id, { version: before.version, narration: 'Short one.' });
    expect(out.scenes[0]).toMatchObject({ narration: 'Short one.', hasAudio: false, durationMs: null });
    expect(out.estimatedSec).toBeLessThan(before.estimatedSec);
  });

  it('edits on-screen text, moves and deletes scenes, keeping order numbers', async () => {
    const { owner, v } = await fresh();
    const ids = v.scenes.map((s) => s.id);
    let cur = await editScene(owner.id, v.id, ids[0], { version: v.version, onScreenText: ['One'] });
    expect(cur.scenes[0].onScreenText).toEqual(['One']);
    cur = await editScene(owner.id, v.id, ids[0], { version: cur.version, moveTo: 2 });
    expect(cur.scenes.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    expect(cur.scenes.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    cur = await deleteScene(owner.id, v.id, ids[1], cur.version);
    expect(cur.scenes.map((s) => s.id)).toEqual([ids[2], ids[0], ids[3]]);
    expect(await code(deleteScene(owner.id, v.id, 'sc_missing', cur.version))).toBe('NOT_FOUND');
  });

  it('will not delete the last scene, and adds a blank scene after a given one', async () => {
    const owner = await member();
    setLlm(fakeLlm([safe, goodBoard(4)]));
    let v = await createVideo(owner, input as never);
    v = await deleteScene(owner.id, v.id, v.scenes[1].id, v.version);
    v = await deleteScene(owner.id, v.id, v.scenes[1].id, v.version);
    v = await deleteScene(owner.id, v.id, v.scenes[1].id, v.version);
    expect(await code(deleteScene(owner.id, v.id, v.scenes[0].id, v.version))).toBe('INVALID');
    const added = await addScene(owner.id, v.id, v.version, v.scenes[0].id);
    expect(added.scenes).toHaveLength(2);
    expect(added.scenes[1]).toMatchObject({ order: 1, title: 'New scene' });
  });

  it('warns when narration runs more than 10% over the chosen length', async () => {
    const { owner, v } = await fresh();
    const out = await editScene(owner.id, v.id, v.scenes[0].id, { version: v.version, narration: 'word '.repeat(150) });
    expect(out.warnings[0]).toMatch(/longer than 1:00/);
  });

  it('regenerates one scene in place without a new cap row, keeping its id', async () => {
    const { owner, v } = await fresh();
    const rewrite = { ...goodScene(1), narration: 'Tilt makes the seasons, not distance.', elements: [{ type: 'bullet', text: 'Tilt', cue: 'Tilt makes' }] };
    setLlm(fakeLlm([rewrite]));
    const out = await regenerateOneScene(owner, v.id, v.scenes[1].id, v.version, 'make it simpler');
    expect(out.scenes[1]).toMatchObject({ id: v.scenes[1].id, order: 1, narration: 'Tilt makes the seasons, not distance.' });
    expect((await getQuota(owner.id, owner.email)).used).toBe(1);
  });

  it('limits AI calls to 20 per member per hour', async () => {
    const owner = await member();
    for (let n = 0; n < 20; n++) await limitLlm(owner.id);
    expect(await code(limitLlm(owner.id))).toBe('RATE_LIMITED');
  });
});
