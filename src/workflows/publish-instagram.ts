import { inngest } from './inngest';

export const publishInstagram = inngest.createFunction(
  { id: 'publish-instagram' },
  { event: 'post/publish.requested' },
  async ({ event, step }) => {
    await step.run('noop', async () => ({ postId: event.data.postId }));
  },
);
