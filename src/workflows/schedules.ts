import { inngest } from './inngest';

export const refreshInstagramTokens = inngest.createFunction(
  { id: 'refresh-instagram-tokens' },
  { cron: '0 3 * * *' },
  async ({ step }) => { await step.run('noop', async () => null); },
);

export const cleanupDeletedVideos = inngest.createFunction(
  { id: 'cleanup-deleted-videos' },
  { cron: '0 4 * * *' },
  async ({ step }) => { await step.run('noop', async () => null); },
);
