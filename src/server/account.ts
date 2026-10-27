import type { ObjectId } from 'mongodb';
import { AppError } from '@/lib/errors';
import { instagramConnections, sessions, users, videos } from '@/server/db/collections';
import { cancelScheduledPosts, type PostDeps } from '@/server/posts/service';

const validZone = (tz: string) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
};

/** Name and time zone (API-Design 5.3). The time zone decides the daily cap's reset and when scheduled posts run. */
export async function updateProfile(userId: ObjectId, input: { name?: string; timeZone?: string }) {
  if (input.timeZone !== undefined && !validZone(input.timeZone)) throw new AppError('VALIDATION', 'That time zone is not known.', 400);
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.timeZone !== undefined) set.timeZone = input.timeZone;
  await users().updateOne({ _id: userId }, { $set: set });
}

/**
 * Delete my data (API-Design 5.4): videos are soft-deleted (the daily cleanup removes their files after 7 days),
 * the Instagram token and scheduled posts go now, and every session ends.
 */
export async function deleteMyData(userId: ObjectId, deps: PostDeps) {
  await cancelScheduledPosts(userId, deps);
  await instagramConnections().deleteOne({ userId });
  const now = new Date();
  await videos().updateMany({ userId, deletedAt: { $exists: false } }, { $set: { deletedAt: now, updatedAt: now } });
  await sessions().deleteMany({ userId });
}
