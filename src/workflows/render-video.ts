import { ObjectId } from 'mongodb';
import { storyboardSchema } from '@/lib/schemas/storyboard';
import { videos } from '@/server/db/collections';
import { readRendered, renderScenes, startSandbox, stopSandbox, uploadBundle } from '@/server/render/sandbox';
import { storage } from '@/server/storage';
import { inngest } from './inngest';

export type RenderRequested = { videoId: string; forceFail?: boolean };

// Steps per docs/Pipeline-Architecture.md. Voice, sync and media come in later phases; this is the
// Phase 1 spike chain: sandbox, bundle, render, upload to R2, update MongoDB.
export const renderVideo = inngest.createFunction(
  {
    id: 'render-video',
    retries: 2,
    onFailure: async ({ event }) => {
      const { videoId } = event.data.event.data as RenderRequested;
      await videos().updateOne(
        { _id: new ObjectId(videoId) },
        { $set: { status: 'failed', failureReason: 'The video could not be rendered. Please try again.', updatedAt: new Date() } },
      );
    },
  },
  { event: 'video/render.requested' },
  async ({ event, step }) => {
    const { videoId, forceFail } = event.data as RenderRequested;
    const _id = new ObjectId(videoId);

    const scenes = await step.run('load-video', async () => {
      const video = await videos().findOne({ _id });
      if (!video) throw new Error(`Video ${videoId} not found`);
      await videos().updateOne({ _id }, { $set: { status: 'rendering', updatedAt: new Date() }, $unset: { failureReason: '' } });
      return storyboardSchema.shape.scenes.parse(video.scenes);
    });

    // A failed attempt leaves its sandbox to the 15 minute timeout set in startSandbox().
    const name = await step.run('start-sandbox', startSandbox);
    await step.run('upload-bundle', () => uploadBundle(name));
    const { filePath, contentType } = await step.run('render', async () => {
      if (forceFail) throw new Error('Forced render failure (test)');
      return renderScenes(name, scenes);
    });
    const outputKey = await step.run('upload-to-r2', async () => {
      const mp4 = await readRendered(name, filePath);
      const key = `videos/${videoId}/final.mp4`;
      await storage().put(key, mp4, contentType || 'video/mp4');
      await videos().updateOne(
        { _id },
        { $set: { status: 'ready', outputKey: key, output: { sizeBytes: mp4.length, validatedAt: new Date() }, updatedAt: new Date() } },
      );
      return key;
    });
    await step.run('stop-sandbox', () => stopSandbox(name));
    return { videoId, outputKey };
  },
);
