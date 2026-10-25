import { ObjectId } from 'mongodb';
import type { VideoStatus } from '@/lib/schemas/video';
import { renderJobs, videos, type VideoDoc } from '@/server/db/collections';
import type { StorageProvider } from '@/server/providers';
import { storage } from '@/server/storage';
import { STAGE_LABEL } from '@/server/render/jobs';

/** What the Library and Home cards need; no scenes, no storage keys. */
export type VideoCardData = {
  id: string; title: string; status: VideoStatus; sceneCount: number; durationSec: number | null;
  failureReason: string | null; createdAt: string; updatedAt: string;
  /** Signed link to the poster frame of a finished video. */
  thumbUrl: string | null;
  /** Progress of the running render, for cards in the `rendering` state. */
  render: { progress: number; stageLabel: string } | null;
};

function durationOf(v: VideoDoc) {
  const ms = (v.scenes as { durationMs?: number }[]).reduce((n, s) => n + (s.durationMs ?? 0), 0);
  return ms > 0 ? Math.round(ms / 1000) : null;
}

export const toCard = (v: VideoDoc): VideoCardData => ({
  id: String(v._id), title: v.title, status: v.status, sceneCount: v.scenes.length, durationSec: durationOf(v),
  failureReason: v.failureReason ?? null, createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  thumbUrl: null, render: null,
});

/** Storage for poster links, or none when R2 is not configured (the cards then use their colour plates). */
function posterStorage(): StorageProvider | undefined {
  try { return storage(); } catch { return undefined; }
}

async function decorate(rows: VideoDoc[], st: StorageProvider | undefined): Promise<VideoCardData[]> {
  const running = rows.filter((v) => v.status === 'rendering').map((v) => v._id);
  const jobs = running.length ? await renderJobs().find({ videoId: { $in: running }, active: true }).toArray() : [];
  return Promise.all(rows.map(async (v) => {
    const card = toCard(v);
    const job = jobs.find((j) => j.videoId.equals(v._id));
    if (job) card.render = { progress: job.progress, stageLabel: STAGE_LABEL[job.stage] };
    if (st && v.thumbKey && v.outputKey && ['ready', 'scheduled', 'posted'].includes(v.status)) {
      card.thumbUrl = await st.signedGet(v.thumbKey, 3600).catch(() => null);
    }
    return card;
  }));
}

/** The member's non-deleted videos, newest first. */
export async function listVideos(userId: ObjectId, limit = 200, st: StorageProvider | undefined = posterStorage()): Promise<VideoCardData[]> {
  const rows = await videos().find({ userId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return decorate(rows, st);
}

export type LibraryQuery = { q?: string; status?: VideoStatus[]; limit?: number; cursor?: string };

/**
 * API-Design 9.1: search by title, filter by status, newest first, paged by cursor. The cursor is the id of the last
 * card of the previous page (ids rise with creation time, so it also orders the pages).
 */
export async function queryLibrary(userId: ObjectId, query: LibraryQuery, st: StorageProvider | undefined = posterStorage()) {
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const filter: Record<string, unknown> = { userId, deletedAt: { $exists: false } };
  if (query.status?.length) filter.status = { $in: query.status };
  const needle = query.q?.trim();
  if (needle) filter.title = { $regex: needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (query.cursor && ObjectId.isValid(query.cursor)) filter._id = { $lt: new ObjectId(query.cursor) };
  const rows = await videos().find(filter).sort({ _id: -1 }).limit(limit + 1).toArray();
  const page = rows.slice(0, limit);
  return { items: await decorate(page, st), nextCursor: rows.length > limit ? String(page[page.length - 1]._id) : null };
}

/** Soft delete: the video disappears from the Library; files are removed later by the cleanup job. */
export async function softDeleteVideo(userId: ObjectId, id: string) {
  if (!ObjectId.isValid(id)) return false;
  const res = await videos().updateOne(
    { _id: new ObjectId(id), userId, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );
  return res.matchedCount === 1;
}
