import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { addApproved, listApproved, removeApproved, updateApproved } from '@/server/admin/approved-emails';
import { getUsage } from '@/server/admin/usage';
import { approvedEmails, users, videos, type VideoDoc } from '@/server/db/collections';
import { listNotices, markNoticesRead, notifyPostFailed, notifyRenderFailed, notifyRenderReady } from '@/server/notifications';
import { dayBounds, formatCountdown, getQuota } from '@/server/quota';
import { listVideos, softDeleteVideo } from '@/server/videos/list';
import { approve } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const ADMIN_ID = '64b000000000000000000001';

async function member(email: string, extra: Partial<{ googleId: string; passwordHash: string }> = {}) {
  await approve(email);
  const _id = new ObjectId();
  await users().insertOne({ _id, email, name: email.split('@')[0], timeZone: 'Asia/Kolkata', createdAt: new Date(), updatedAt: new Date(), ...extra });
  return _id;
}
async function video(userId: ObjectId, status: VideoDoc['status'], extra: Partial<VideoDoc> = {}) {
  const now = new Date();
  const doc: VideoDoc = {
    _id: new ObjectId(), userId, title: `v-${status}`, status, scenes: [{ durationMs: 10_000 }, { durationMs: 20_000 }] as never,
    version: 1, createdAt: now, updatedAt: now, ...extra,
  };
  await videos().insertOne(doc);
  return doc;
}

describe('daily quota', () => {
  it('day bounds follow the member time zone', () => {
    const now = new Date('2026-10-24T18:00:00Z'); // 23:30 in Kolkata, still the 24th there
    const { start, end } = dayBounds('Asia/Kolkata', now);
    expect(start.toISOString()).toBe('2026-10-23T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-24T18:30:00.000Z');
    expect(formatCountdown(end.getTime() - now.getTime())).toBe('0h 30m');
  });
  it('counts today\'s videos except failed ones, and keeps deleted ones counted', async () => {
    const id = await member('t@example.com');
    await video(id, 'ready');
    await video(id, 'draft', { deletedAt: new Date() });
    await video(id, 'failed');
    await video(id, 'ready', { createdAt: new Date(Date.now() - 3 * 86400e3) });
    const q = await getQuota(id, 't@example.com');
    expect([q.used, q.limit, q.left]).toEqual([2, 5, 3]);
  });
  it('caps left at zero when the limit is passed', async () => {
    const id = await member('t@example.com');
    await approvedEmails().updateOne({ email: 't@example.com' }, { $set: { dailyLimit: 1 } });
    await video(id, 'ready'); await video(id, 'ready');
    expect((await getQuota(id, 't@example.com')).left).toBe(0);
  });
});

describe('library data', () => {
  it('lists only the member\'s own non-deleted videos, newest first, with durations', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    await video(a, 'draft', { createdAt: new Date(Date.now() - 5000) });
    await video(a, 'ready');
    await video(a, 'ready', { deletedAt: new Date() });
    await video(b, 'ready');
    const list = await listVideos(a);
    expect(list.map((v) => v.status)).toEqual(['ready', 'draft']);
    expect([list[0].sceneCount, list[0].durationSec]).toEqual([2, 30]);
  });
  it('soft delete needs ownership and keeps the row', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const v = await video(a, 'ready');
    expect(await softDeleteVideo(b, String(v._id))).toBe(false);
    expect(await softDeleteVideo(a, 'not-an-id')).toBe(false);
    expect(await softDeleteVideo(a, String(v._id))).toBe(true);
    expect(await softDeleteVideo(a, String(v._id))).toBe(false);
    expect((await videos().findOne({ _id: v._id }))?.deletedAt).toBeInstanceOf(Date);
    expect(await listVideos(a)).toEqual([]);
  });
});

describe('admin members screen data', () => {
  it('reports status, sign-in methods and joined date; invites have no account', async () => {
    await member('both@example.com', { googleId: 'g', passwordHash: 'h' });
    await addApproved({ email: 'invited@example.com' }, ADMIN_ID);
    const items = await listApproved({ includeRemoved: true });
    const both = items.find((i) => i.email === 'both@example.com')!;
    expect([both.status, both.methods, both.joinedAt instanceof Date]).toEqual(['active', { google: true, password: true }, true]);
    expect(items.find((i) => i.email === 'invited@example.com')?.status).toBe('invited');
  });
  it('suspends, lists as suspended, reinstates', async () => {
    await member('m@example.com');
    const row = (await listApproved())[0];
    await removeApproved(row.id, ADMIN_ID);
    expect((await listApproved({ includeRemoved: true }))[0].status).toBe('suspended');
    expect(await listApproved()).toEqual([]);
    await updateApproved(row.id, { reinstate: true }, ADMIN_ID);
    expect((await listApproved())[0].status).toBe('active');
    expect(await code(updateApproved(row.id, { reinstate: true }, ADMIN_ID))).toBe('NOT_FOUND');
  });
  it('suspending with deleteVideos soft-deletes that member\'s videos only', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    await video(a, 'ready'); await video(b, 'ready');
    await removeApproved((await listApproved()).find((i) => i.email === 'a@example.com')!.id, ADMIN_ID, { deleteVideos: true });
    expect(await listVideos(a)).toEqual([]);
    expect(await listVideos(b)).toHaveLength(1);
  });
  it('"delete data" removes videos without suspending', async () => {
    const a = await member('a@example.com');
    await video(a, 'draft');
    const row = (await listApproved())[0];
    await updateApproved(row.id, { deleteVideos: true }, ADMIN_ID);
    expect(await listVideos(a)).toEqual([]);
    expect((await listApproved())[0].status).toBe('active');
  });
  it('revoking an invite nobody accepted deletes it instead of suspending', async () => {
    const inv = await addApproved({ email: 'invited@example.com' }, ADMIN_ID);
    await removeApproved(inv.id, ADMIN_ID);
    expect(await approvedEmails().countDocuments({ email: 'invited@example.com' })).toBe(0);
  });
});

describe('admin usage numbers', () => {
  it('counts today, this month, posted and per-member totals; voice credits are unknown', async () => {
    const a = await member('a@example.com');
    await video(a, 'ready'); await video(a, 'posted'); await video(a, 'failed');
    const u = await getUsage();
    expect([u.today.videos, u.month.videos, u.month.posted, u.month.ready]).toEqual([2, 3, 1, 2]);
    expect(u.today.cap).toBe(5);
    expect(u.voice).toEqual({ used: 0, total: 10000, tracked: true });
    expect(u.members[0]).toMatchObject({ email: 'a@example.com', total: 3, avgSec: 30 });
    expect(u.members[0].spark.at(-1)).toBe(3);
  });
});

describe('notifications', () => {
  it('stores each event once, lists newest first and tracks read state', async () => {
    const id = await member('a@example.com');
    const ready = await video(id, 'ready', { title: 'Seasons' });
    const failed = await video(id, 'failed', { title: 'Water cycle' });
    await notifyRenderReady(ready._id, id);
    await notifyRenderReady(ready._id, id); // a retried workflow step must not double up
    await notifyRenderFailed(failed._id, id, 'Audio timed out');
    const first = await listNotices(id);
    expect(first.unread).toBe(2);
    expect(first.items).toHaveLength(2);
    expect(first.items.find((n) => n.kind === 'error')).toMatchObject({ title: 'Water cycle failed', body: 'Audio timed out', retry: true });
    await markNoticesRead(id);
    const after = await listNotices(id);
    expect([after.unread, after.items.every((n) => !n.unread)]).toEqual([0, true]);
    await notifyPostFailed(new ObjectId(), ready._id, id, 'Instagram refused the video.');
    expect((await listNotices(id)).unread).toBe(1);
  });

  it('only shows a member their own notices', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    await notifyRenderReady((await video(a, 'ready'))._id, a);
    expect((await listNotices(b)).items).toEqual([]);
  });
});
