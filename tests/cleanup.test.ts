import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { cleanupDeletedVideos } from '@/server/cleanup';
import { notifications, posts, renderJobs, usageLog, videos, type VideoDoc } from '@/server/db/collections';
import type { StorageProvider } from '@/server/providers';

const DAY = 24 * 3600e3;
const NOW = new Date('2026-11-01T00:00:00Z');

function fakeStore(files: Set<string>, failOn?: string): StorageProvider {
  return {
    put: async () => undefined, exists: async (k) => files.has(k), delete: async (k) => { files.delete(k); }, signedGet: async (k) => k,
    list: async () => [], deletePrefix: async (p) => {
      if (failOn && p.includes(failOn)) throw new Error('R2 down');
      const hit = [...files].filter((k) => k.startsWith(p));
      hit.forEach((k) => files.delete(k));
      return hit.length;
    },
  };
}
async function video(deletedDaysAgo?: number) {
  const _id = new ObjectId();
  const at = new Date(NOW.getTime() - 30 * DAY);
  await videos().insertOne({
    _id, userId: new ObjectId(), title: 't', status: 'ready', scenes: [], version: 1, createdAt: at, updatedAt: at,
    ...(deletedDaysAgo === undefined ? {} : { deletedAt: new Date(NOW.getTime() - deletedDaysAgo * DAY) }),
  } as VideoDoc);
  return _id;
}

describe('cleanup', () => {
  it('removes files, jobs, posts and the document of videos deleted over 7 days ago, and nothing else', async () => {
    const old = await video(8);
    const recent = await video(3);
    const live = await video();
    const files = new Set([`videos/${old}/out/a.mp4`, `videos/${old}/audio/s.mp3`, `videos/${recent}/out/b.mp4`, `videos/${live}/out/c.mp4`, 'music/healing.mp3']);
    await renderJobs().insertMany([{ videoId: old }, { videoId: recent }] as never);
    await posts().insertOne({ videoId: old } as never);
    await notifications().insertOne({ _id: new ObjectId(), userId: new ObjectId(), kind: 'render_ready', refId: old, title: '', body: '', href: '', retry: false, createdAt: NOW });

    const r = await cleanupDeletedVideos(fakeStore(files), NOW);

    expect(r).toMatchObject({ videos: 1, files: 2, jobs: 1, failed: 0 });
    expect([...files].sort()).toEqual([`videos/${live}/out/c.mp4`, `videos/${recent}/out/b.mp4`, 'music/healing.mp3'].sort());
    expect(await videos().countDocuments({ _id: old })).toBe(0);
    expect(await videos().countDocuments({ _id: { $in: [recent, live] } })).toBe(2);
    expect(await renderJobs().countDocuments({ videoId: recent })).toBe(1);
    expect(await posts().countDocuments()).toBe(0);
    expect(await notifications().countDocuments()).toBe(0);
  });

  it('keeps a video whose files could not be deleted, so the next run tries again', async () => {
    const stuck = await video(10);
    const files = new Set([`videos/${stuck}/out/a.mp4`]);
    const r = await cleanupDeletedVideos(fakeStore(files, String(stuck)), NOW);
    expect(r).toMatchObject({ videos: 0, failed: 1 });
    expect(await videos().countDocuments({ _id: stuck })).toBe(1);
    expect(files.size).toBe(1);
  });

  it('drops finished render jobs after 90 days and usage rows after 13 months, never an active job', async () => {
    const v = new ObjectId();
    await renderJobs().insertMany([
      { videoId: v, status: 'succeeded', finishedAt: new Date(NOW.getTime() - 91 * DAY) },
      { videoId: v, status: 'succeeded', finishedAt: new Date(NOW.getTime() - 10 * DAY) },
      { videoId: v, status: 'running', active: true, queuedAt: new Date(NOW.getTime() - 200 * DAY) },
    ] as never);
    await usageLog().insertMany([
      { _id: new ObjectId(), userId: v, type: 'voice_credits', amount: 5, createdAt: new Date(NOW.getTime() - 400 * DAY) },
      { _id: new ObjectId(), userId: v, type: 'voice_credits', amount: 5, createdAt: new Date(NOW.getTime() - 5 * DAY) },
    ]);
    const r = await cleanupDeletedVideos(fakeStore(new Set()), NOW);
    expect(r).toMatchObject({ jobs: 1, usageRows: 1 });
    expect(await renderJobs().countDocuments()).toBe(2);
    expect(await usageLog().countDocuments()).toBe(1);
  });
});

describe('backup', () => {
  it('writes one gzip export with restorable types and keeps only the newest four', async () => {
    const { exportBackup } = await import('@/server/backup');
    const { gunzipSync } = await import('node:zlib');
    const { BSON } = await import('mongodb');
    await video();
    const files = new Map<string, Buffer>(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'].map((d) => [`backups/${d}.json.gz`, Buffer.from('x')]));
    const store: StorageProvider = {
      put: async (k, b) => { files.set(k, b); }, exists: async (k) => files.has(k), delete: async (k) => { files.delete(k); }, signedGet: async (k) => k,
      list: async (p) => [...files.keys()].filter((k) => k.startsWith(p)), deletePrefix: async () => 0,
    };
    const r = await exportBackup(store, NOW);
    expect(r.key).toBe('backups/2026-11-01.json.gz');
    expect([...files.keys()].sort()).toEqual(['backups/2026-09-15.json.gz', 'backups/2026-09-22.json.gz', 'backups/2026-09-29.json.gz', 'backups/2026-11-01.json.gz']);
    const out = BSON.EJSON.parse(gunzipSync(files.get(r.key)!).toString(), { relaxed: false }) as { collections: { videos: { _id: ObjectId; createdAt: Date }[] } };
    expect(out.collections.videos[0]._id).toBeInstanceOf(ObjectId);
    expect(out.collections.videos[0].createdAt).toBeInstanceOf(Date);
  });
});
