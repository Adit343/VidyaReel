import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { assertSameOrigin } from '@/server/auth/http';
import { posts, videos, type PostDoc, type VideoDoc } from '@/server/db/collections';
import { getPost, retryPost, updatePost } from '@/server/posts/service';
import { cancelRender, getRenderStatus, startRender } from '@/server/render/jobs';
import { listVideos, softDeleteVideo } from '@/server/videos/list';
import { deleteScene, duplicateVideo, editScene, getVideo, updateVideo } from '@/server/videos/service';
import { req } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const mine = new ObjectId();
const stranger = { id: new ObjectId(), email: 'stranger@example.com' };

async function seed() {
  const now = new Date();
  const doc = {
    _id: new ObjectId(), userId: mine, title: 'Mine', status: 'ready', version: 1, createdAt: now, updatedAt: now,
    scenes: [{ id: 's1', template: 'title-hook', narration: 'Hello there', elements: [] }],
  } as unknown as VideoDoc;
  await videos().insertOne(doc);
  const post = { _id: new ObjectId(), videoId: doc._id, userId: mine, connectionId: new ObjectId(), caption: 'c', mode: 'now', status: 'failed', retryCount: 0, rev: 1, createdAt: now, updatedAt: now } as PostDoc;
  await posts().insertOne(post);
  return { id: String(doc._id), postId: String(post._id) };
}

describe('ownership: a signed-in stranger gets NOT_FOUND for every video and post action', () => {
  it('video actions', async () => {
    const { id } = await seed();
    const s = stranger.id;
    expect(await code(getVideo(s, id))).toBe('NOT_FOUND');
    expect(await code(updateVideo(s, id, { version: 1, title: 'x' } as never))).toBe('NOT_FOUND');
    expect(await code(editScene(s, id, 's1', { version: 1, narration: 'x' } as never))).toBe('NOT_FOUND');
    expect(await code(deleteScene(s, id, 's1', 1))).toBe('NOT_FOUND');
    expect(await code(duplicateVideo(stranger, id))).toBe('NOT_FOUND');
    expect(await softDeleteVideo(s, id)).toBe(false);
    expect(await code(startRender(stranger, id, { version: 1 }, { send: async () => undefined } as never))).toBe('NOT_FOUND');
    expect(await code(getRenderStatus(s, id, {} as never))).toBe('NOT_FOUND');
    expect(await code(cancelRender(s, id, { send: async () => undefined } as never))).toBe('NOT_FOUND');
    expect(await listVideos(s)).toEqual([]);
    expect(await videos().countDocuments({ _id: new ObjectId(id), deletedAt: { $exists: false } })).toBe(1);
  });

  it('post actions', async () => {
    const { postId } = await seed();
    const deps = { send: async () => undefined } as never;
    expect(await code(getPost(stranger.id, postId))).toBe('NOT_FOUND');
    expect(await code(updatePost(stranger.id, postId, { cancel: true }, deps))).toBe('NOT_FOUND');
    expect(await code(retryPost(stranger.id, postId, deps))).toBe('NOT_FOUND');
  });

  it('malformed ids are a 404, not a crash', async () => {
    expect(await code(getVideo(stranger.id, 'not-an-id'))).toBe('NOT_FOUND');
    expect(await code(getPost(stranger.id, '123'))).toBe('NOT_FOUND');
  });
});

describe('same-origin check', () => {
  const post = (headers: Record<string, string>, url = 'http://localhost:3000/api/x') => req(url, { method: 'POST', headers });
  it('allows the app origin and requests with no Origin header', () => {
    expect(() => assertSameOrigin(post({ origin: 'http://localhost:3000' }))).not.toThrow();
    expect(() => assertSameOrigin(post({}))).not.toThrow();
  });
  it('refuses another site', () => {
    expect(() => assertSameOrigin(post({ origin: 'https://evil.example' }))).toThrow(AppError);
    expect(() => assertSameOrigin(post({ origin: 'http://localhost:3001' }))).toThrow(AppError);
  });
});
