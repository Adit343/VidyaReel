import { refreshDueTokens } from '@/server/instagram/connection';
import { inngest } from './inngest';

// Daily at 03:00 UTC: renew Instagram tokens that expire within 10 days (docs/System-Design.md 8.2).
export const refreshInstagramTokens = inngest.createFunction(
  { id: 'refresh-instagram-tokens' },
  { cron: '0 3 * * *' },
  async ({ step }) => step.run('refresh', () => refreshDueTokens()),
);

export const cleanupDeletedVideos = inngest.createFunction(
  { id: 'cleanup-deleted-videos' },
  { cron: '0 4 * * *' },
  async ({ step }) => { await step.run('noop', async () => null); },
);
