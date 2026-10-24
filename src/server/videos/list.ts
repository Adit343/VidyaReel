import { ObjectId } from 'mongodb';
import type { VideoStatus } from '@/lib/schemas/video';
import { videos, type VideoDoc } from '@/server/db/collections';

/** What the Library and Home cards need; no scenes, no storage keys. */
export type VideoCardData = {
  id: string; title: string; status: VideoStatus; sceneCount: number; durationSec: number | null;
  failureReason: string | null; createdAt: string; updatedAt: string;
};

function durationOf(v: VideoDoc) {
  const ms = (v.scenes as { durationMs?: number }[]).reduce((n, s) => n + (s.durationMs ?? 0), 0);
  return ms > 0 ? Math.round(ms / 1000) : null;
}

export const toCard = (v: VideoDoc): VideoCardData => ({
  id: String(v._id), title: v.title, status: v.status, sceneCount: v.scenes.length, durationSec: durationOf(v),
  failureReason: v.failureReason ?? null, createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
});

/** The member's non-deleted videos, newest first. */
export async function listVideos(userId: ObjectId, limit = 200): Promise<VideoCardData[]> {
  const rows = await videos().find({ userId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return rows.map(toCard);
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
