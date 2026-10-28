import { errorFields, log } from '@/lib/log';
import { assets, notifications, posts, renderJobs, usageLog, videos } from '@/server/db/collections';
import type { StorageProvider } from '@/server/providers';

const DAY = 24 * 3600e3;
export const GRACE_DAYS = 7;
export const JOB_DAYS = 90;
const BATCH = 50;

export type CleanupResult = { videos: number; files: number; jobs: number; usageRows: number; failed: number };

/**
 * Daily housekeeping (docs/Database-Design.md section 8): videos deleted more than 7 days ago lose their R2 folder,
 * render jobs, posts (not the Instagram post itself), licence rows and notices, then the video document goes.
 * Finished render jobs older than 90 days and usage rows older than 13 months are dropped. A video whose files cannot
 * be deleted is kept and tried again tomorrow, so no file is ever orphaned by a half-finished cleanup.
 */
export async function cleanupDeletedVideos(store: StorageProvider, now = new Date()): Promise<CleanupResult> {
  const out: CleanupResult = { videos: 0, files: 0, jobs: 0, usageRows: 0, failed: 0 };
  const due = await videos().find({ deletedAt: { $lte: new Date(now.getTime() - GRACE_DAYS * DAY) } }, { projection: { _id: 1 } }).limit(BATCH).toArray();
  for (const { _id } of due) {
    try {
      out.files += await store.deletePrefix(`videos/${_id}/`);
      out.jobs += (await renderJobs().deleteMany({ videoId: _id })).deletedCount;
      await posts().deleteMany({ videoId: _id });
      await assets().deleteMany({ videoId: _id });
      await notifications().deleteMany({ refId: _id });
      await videos().deleteOne({ _id });
      out.videos += 1;
    } catch (e) {
      out.failed += 1;
      log('error', 'cleanup failed for a video', { videoId: String(_id), ...errorFields(e) });
    }
  }
  out.jobs += (await renderJobs().deleteMany({ active: { $exists: false }, finishedAt: { $lt: new Date(now.getTime() - JOB_DAYS * DAY) } })).deletedCount;
  out.usageRows = (await usageLog().deleteMany({ createdAt: { $lt: new Date(now.getTime() - 396 * DAY) } })).deletedCount;
  log('info', 'cleanup finished', out);
  return out;
}
