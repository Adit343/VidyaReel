import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { nextStepFor } from '@/components/video/status';
import { AppError } from '@/lib/errors';
import { approvedEmails, renderJobs, videos, type VideoDoc } from '@/server/db/collections';
import type { StorageProvider } from '@/server/providers';
import { queryLibrary } from '@/server/videos/list';
import { duplicateVideo } from '@/server/videos/service';
import { approve } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const st: StorageProvider = { put: async () => undefined, list: async () => [], deletePrefix: async () => 0, exists: async () => true, delete: async () => undefined, signedGet: async (k) => `https://signed.example/${k}` };

async function add(userId: ObjectId, title: string, status: VideoDoc['status'], extra: Partial<VideoDoc> = {}) {
  const now = new Date();
  const doc: VideoDoc = { _id: new ObjectId(), userId, title, status, scenes: [], version: 1, createdAt: now, updatedAt: now, ...extra };
  await videos().insertOne(doc);
  return doc;
}

describe('library query', () => {
  it('filters by status and title, pages by cursor, and hides deleted and other people\'s videos', async () => {
    const me = new ObjectId();
    for (let i = 0; i < 5; i++) await add(me, `Rain ${i}`, i % 2 ? 'ready' : 'draft');
    await add(me, 'Gone', 'ready', { deletedAt: new Date() });
    await add(new ObjectId(), 'Rain elsewhere', 'ready');
    await add(me, 'Fractions (a+b)', 'ready');

    const ready = await queryLibrary(me, { status: ['ready'] }, st);
    expect(ready.items.map((c) => c.title).sort()).toEqual(['Fractions (a+b)', 'Rain 1', 'Rain 3']);
    expect((await queryLibrary(me, { q: 'rain' }, st)).items).toHaveLength(5);
    expect((await queryLibrary(me, { q: '(a+b)' }, st)).items.map((c) => c.title)).toEqual(['Fractions (a+b)']); // special characters are literal

    const first = await queryLibrary(me, { limit: 4 }, st);
    expect(first.items).toHaveLength(4);
    expect(first.nextCursor).toBeTruthy();
    const second = await queryLibrary(me, { limit: 4, cursor: first.nextCursor! }, st);
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((c) => c.id)).size).toBe(6);
  });

  it('adds the render progress to running cards and a poster link to finished ones', async () => {
    const me = new ObjectId();
    const run = await add(me, 'Running', 'rendering');
    await renderJobs().insertOne({ _id: new ObjectId(), videoId: run._id, userId: me, kind: 'full', status: 'running', stage: 'render', progress: 61, attempt: 1, active: true, queuedAt: new Date() });
    await add(me, 'Done', 'ready', { outputKey: 'videos/x/out/j.mp4', thumbKey: 'videos/x/thumb-j.jpg' });
    await add(me, 'Done without poster', 'ready', { outputKey: 'videos/x/out/k.mp4' });
    const { items } = await queryLibrary(me, {}, st);
    const by = Object.fromEntries(items.map((c) => [c.title, c]));
    expect(by.Running.render).toEqual({ progress: 61, stageLabel: 'Rendering video' });
    expect(by.Done.thumbUrl).toBe('https://signed.example/videos/x/thumb-j.jpg');
    expect(by['Done without poster'].thumbUrl).toBeNull();
    expect(by.Done.render).toBeNull();
  });

  it('a failed video with no script goes to Review, not Generate', () => {
    expect(nextStepFor({ status: 'failed', sceneCount: 0 }).to('abc')).toBe('/videos/abc/review');
    expect(nextStepFor({ status: 'failed', sceneCount: 4 }).to('abc')).toBe('/videos/abc/generate');
    expect(nextStepFor({ status: 'ready', sceneCount: 4 }).to('abc')).toBe('/videos/abc/post');
  });
});

describe('duplicate', () => {
  const scene = (id: string) => ({
    id, order: 0, template: 'stock-clip', title: 'T', narration: 'Words here', needsCheck: false, durationMs: 4000,
    elements: [{ id: 'el_1', type: 'bullet', text: 'x', cue: 'Words', startMs: 300 }], media: { query: 'leaf', assetId: 'a1', durationSec: 9 },
    audio: { key: 'k', hash: 'h', durationMs: 3000, words: [] },
  });

  it('copies script and settings but none of the render files, and counts as a new video', async () => {
    await approve('d@example.com');
    const me = new ObjectId();
    const src = await add(me, 'Seasons', 'ready', {
      scenes: [scene('sc_1')] as never, voiceId: 'v1', theme: 'saffron', musicId: 'healing-piano', caption: 'cap', hashtags: ['#a'],
      outputKey: 'videos/x/out/j.mp4', thumbKey: 't', output: { sizeBytes: 1, validatedAt: new Date() },
    });
    const copy = await duplicateVideo({ id: me, email: 'd@example.com' }, String(src._id));
    expect(copy).toMatchObject({ title: 'Seasons (copy)', status: 'storyboard_ready', version: 1, theme: 'saffron', voiceId: 'v1', musicId: 'healing-piano', caption: 'cap' });
    const stored = (await videos().findOne({ _id: new ObjectId(copy.id) }))!;
    expect(stored.outputKey).toBeUndefined();
    expect(stored.scenes[0].id).not.toBe('sc_1');
    expect(stored.scenes[0].audio).toBeUndefined();
    expect(stored.scenes[0].durationMs).toBeUndefined();
    expect(stored.scenes[0].elements[0].startMs).toBeUndefined();
    expect(stored.scenes[0].media).toEqual({ query: 'leaf' });
    expect(await videos().countDocuments({ userId: me })).toBe(2);
    // the original is untouched
    expect((await videos().findOne({ _id: src._id }))?.scenes[0].audio).toBeDefined();
  });

  it('needs a script, a free daily slot and ownership', async () => {
    await approve('d@example.com');
    const me = new ObjectId();
    const empty = await add(me, 'Empty', 'failed');
    expect(await code(duplicateVideo({ id: me, email: 'd@example.com' }, String(empty._id)))).toBe('INVALID_STATE');
    const full = await add(me, 'Full', 'ready', { scenes: [scene('sc_1')] as never });
    expect(await code(duplicateVideo({ id: new ObjectId(), email: 'd@example.com' }, String(full._id)))).toBe('NOT_FOUND');
    await approvedEmails().updateOne({ email: 'd@example.com' }, { $set: { dailyLimit: 1 } });
    expect(await code(duplicateVideo({ id: me, email: 'd@example.com' }, String(full._id)))).toBe('DAILY_LIMIT');
  });
});
