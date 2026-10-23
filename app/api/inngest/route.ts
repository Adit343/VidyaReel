import { serve } from 'inngest/next';
import { inngest } from '@/workflows/inngest';
import { renderVideo, publishInstagram, refreshInstagramTokens, cleanupDeletedVideos } from '@/workflows';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [renderVideo, publishInstagram, refreshInstagramTokens, cleanupDeletedVideos],
});
