import { exportBackup as runBackup } from '@/server/backup';
import { cleanupDeletedVideos as runCleanup } from '@/server/cleanup';
import { refreshDueTokens } from '@/server/instagram/connection';
import { storage } from '@/server/storage';
import { inngest } from './inngest';

// Daily at 03:00 UTC: renew Instagram tokens that expire within 10 days (docs/System-Design.md 8.2).
export const refreshInstagramTokens = inngest.createFunction(
  { id: 'refresh-instagram-tokens' },
  { cron: '0 3 * * *' },
  async ({ step }) => step.run('refresh', () => refreshDueTokens()),
);

// Daily at 04:00 UTC: files and rows of videos deleted over 7 days ago, old render jobs and usage rows.
export const cleanupDeletedVideos = inngest.createFunction(
  { id: 'cleanup-deleted-videos' },
  { cron: '0 4 * * *' },
  async ({ step }) => step.run('cleanup', () => runCleanup(storage())),
);

// Sundays at 02:00 UTC: a gzip export of the main collections to the private bucket, newest four kept.
export const exportBackup = inngest.createFunction(
  { id: 'export-backup' },
  { cron: '0 2 * * 0' },
  async ({ step }) => step.run('export', () => runBackup(storage())),
);
