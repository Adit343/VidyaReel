import { inngest } from './inngest';

// Steps per docs/Pipeline-Architecture.md: voice+timing, sync, media, props,
// render:start (Sandbox, detached), poll, upload to R2, update MongoDB.
export const renderVideo = inngest.createFunction(
  { id: 'render-video' },
  { event: 'video/render.requested' },
  async ({ event, step }) => {
    await step.run('noop', async () => ({ videoId: event.data.videoId }));
  },
);
