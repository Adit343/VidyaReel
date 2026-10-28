import { serve } from 'inngest/next';
import { inngest } from '@/workflows/inngest';
import { renderVideo, publishInstagram, refreshInstagramTokens, cleanupDeletedVideos, exportBackup } from '@/workflows';

// Each Inngest step runs inside one call of this route; the longest (the Sandbox render) needs the full allowance.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [renderVideo, publishInstagram, refreshInstagramTokens, cleanupDeletedVideos, exportBackup],
});
