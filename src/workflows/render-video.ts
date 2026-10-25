import { ObjectId } from 'mongodb';
import { renderJobs, videos } from '@/server/db/collections';
import { createMedia } from '@/server/media';
import { failJob, setProgress } from '@/server/render/jobs';
import { buildProps, mediaScene, syncVideo, voiceScene, type RenderDeps } from '@/server/render/pipeline';
import { readRendered, renderPoster, renderScenes, startSandbox, stopSandbox, uploadBundle } from '@/server/render/sandbox';
import { storage } from '@/server/storage';
import { storageKey } from '@/server/storage/keys';
import { createElevenLabsVoice } from '@/server/voice';
import { inngest } from './inngest';

export type RenderRequested = { videoId: string; jobId: string; userId?: string; sceneIds?: string[]; forceFail?: boolean };

const deps = (): RenderDeps => ({ storage: storage(), voice: () => createElevenLabsVoice(), media: () => createMedia() });

// Steps per docs/System-Design.md section 6 (renderVideo, step by step). Step results hold ids and numbers only:
// signed links are made inside the step that uses them, never returned.
export const renderVideo = inngest.createFunction(
  {
    id: 'render-video',
    retries: 2,
    concurrency: { limit: 1 },
    cancelOn: [{ event: 'video/render.cancel', match: 'data.videoId' }],
    onFailure: async ({ event, error }) => {
      const { jobId } = event.data.event.data as RenderRequested;
      const job = await renderJobs().findOne({ _id: new ObjectId(jobId) });
      if (job?.sandboxId) await stopSandbox(job.sandboxId);
      await failJob(jobId, error);
    },
  },
  { event: 'video/render.requested' },
  async ({ event, step }) => {
    const { videoId, jobId, forceFail } = event.data as RenderRequested;
    const job = new ObjectId(jobId);
    const video = new ObjectId(videoId);
    const d = deps();

    const sceneIds = await step.run('load', async () => {
      const v = await videos().findOne({ _id: video });
      if (!v?.scenes.length) throw new Error(`Video ${videoId} has no scenes`);
      await renderJobs().updateOne({ _id: job, active: true }, { $set: { status: 'running', stage: 'load', startedAt: new Date() }, $max: { progress: 3 } });
      return v.scenes.map((s) => s.id);
    });

    // Voice: one scene at a time (the free ElevenLabs plan allows two requests at once); unchanged scenes are reused.
    let credits = 0;
    for (const [n, id] of sceneIds.entries()) {
      const r = await step.run(`voice:${id}`, async () => {
        await setProgress(jobId, 'voice', 5 + (25 * n) / sceneIds.length);
        return voiceScene(d, videoId, id);
      });
      credits += r.credits;
    }

    const synced = await step.run('sync', async () => {
      await setProgress(jobId, 'sync', 32);
      return syncVideo(videoId);
    });

    const clipless: string[] = [];
    for (const [n, id] of sceneIds.entries()) {
      const r = await step.run(`media:${id}`, async () => {
        await setProgress(jobId, 'media', 36 + (4 * n) / sceneIds.length);
        return mediaScene(d, videoId, id);
      });
      if (!r.found) clipless.push(id);
    }

    await step.run('props', async () => {
      await setProgress(jobId, 'props', 40);
      const { props, fallbacks } = await buildProps(d, videoId, { sign: false });
      await d.storage.put(storageKey.props(videoId, jobId), Buffer.from(JSON.stringify(props)), 'application/json');
      if (fallbacks.length) {
        await renderJobs().updateOne({ _id: job }, { $set: { warnings: fallbacks.map((id) => `Scene ${id} had no stock clip and was drawn as a text scene.`) } });
      }
    });

    // A failed attempt leaves its sandbox to the 15 minute timeout set in startSandbox(), or to failJob().
    const sandbox = await step.run('start-sandbox', async () => {
      await setProgress(jobId, 'render', 42);
      const name = await startSandbox();
      await renderJobs().updateOne({ _id: job }, { $set: { sandboxId: name } });
      return name;
    });
    await step.run('upload-bundle', () => uploadBundle(sandbox));
    const rendered = await step.run('render', async () => {
      if (forceFail) throw new Error('Forced render failure (test)');
      const { props } = await buildProps(d, videoId, { sign: true });
      let lastWrite = 0;
      return renderScenes(sandbox, props, async (fraction) => {
        // At most one write every two seconds; the screen polls every three.
        if (Date.now() - lastWrite < 2000) return;
        lastWrite = Date.now();
        await setProgress(jobId, 'render', 42 + fraction * 48);
      });
    });
    const poster = await step.run('poster', async () => {
      try {
        const { props } = await buildProps(d, videoId, { sign: true });
        return (await renderPoster(sandbox, props)).filePath;
      } catch {
        return null; // a missing poster must not fail the video
      }
    });

    const saved = await step.run('upload', async () => {
      await setProgress(jobId, 'upload', 92);
      const mp4 = await readRendered(sandbox, rendered.filePath);
      const outputKey = storageKey.output(videoId, jobId);
      await d.storage.put(outputKey, mp4, rendered.contentType || 'video/mp4');
      let thumbKey: string | null = null;
      if (poster) {
        try {
          thumbKey = storageKey.thumb(videoId, jobId);
          await d.storage.put(thumbKey, await readRendered(sandbox, poster), 'image/jpeg');
        } catch { thumbKey = null; }
      }
      return { outputKey, thumbKey, sizeBytes: mp4.length };
    });

    return step.run('finalise', async () => {
      const finishedAt = new Date();
      const done = await renderJobs().findOneAndUpdate(
        { _id: job, active: true },
        {
          $set: { status: 'succeeded', stage: 'finalise', progress: 100, finishedAt, outputKey: saved.outputKey, voiceCredits: credits, ...(saved.thumbKey ? { thumbKey: saved.thumbKey } : {}) },
          $unset: { active: '' },
        },
        { returnDocument: 'after' },
      );
      if (!done) return { videoId, cancelled: true }; // the member cancelled while this step was starting
      const before = await videos().findOneAndUpdate(
        { _id: video },
        {
          $set: {
            status: 'ready', outputKey: saved.outputKey, ...(saved.thumbKey ? { thumbKey: saved.thumbKey } : {}),
            output: { sizeBytes: saved.sizeBytes, validatedAt: finishedAt, durationMs: synced.durationMs }, updatedAt: finishedAt,
          },
          $inc: { version: 1 }, $unset: { currentJobId: '', failureReason: '' },
        },
        { returnDocument: 'before' },
      );
      await renderJobs().updateOne({ _id: job }, { $set: { renderSec: Math.round((finishedAt.getTime() - (done.startedAt ?? done.queuedAt).getTime()) / 1000) } });
      // Replace the older render and poster so storage does not pile up.
      for (const old of [before?.outputKey, before?.thumbKey]) {
        if (old && old !== saved.outputKey && old !== saved.thumbKey) await d.storage.delete(old).catch(() => undefined);
      }
      await stopSandbox(sandbox);
      return { videoId, outputKey: saved.outputKey, clipless };
    });
  },
);
