import { NonRetriableError } from 'inngest';
import { createInstagramPublisher } from '@/server/instagram/api';
import {
  checkContainer, claim, ensureContainer, failPost, finish, startOfRun, toPostError, type PublishDeps,
} from '@/server/posts/publish';
import { storage } from '@/server/storage';
import { inngest } from './inngest';

export type PostRequested = { postId: string; userId: string; rev: number };

const deps = (): PublishDeps => ({ publisher: createInstagramPublisher(), storage: storage() });

/** The longest single sleep. Long schedules sleep in hops so no plan limit on one sleep can cut a run short. */
const HOP_MS = 5 * 24 * 3600e3;
/** About 12 minutes of waiting for Instagram to process the video (it took 24 to 83 s in the Phase 1 test). */
const POLL_ATTEMPTS = 40;

/**
 * Runs one step; an error that retrying cannot fix (expired token, video refused) is saved on the post right away and
 * stops the run, while a network or 5xx error is thrown as it is so Inngest retries the step.
 */
async function guarded<T>(postId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = toPostError(e);
    if (!err.final) throw err;
    await failPost(postId, err);
    throw new NonRetriableError(err.message);
  }
}

// docs/System-Design.md section 6 (publishInstagram, step by step). A reschedule, cancel or retry changes the post's
// `rev`; a run that wakes up with an older `rev` ends quietly and the newer run does the work.
export const publishInstagram = inngest.createFunction(
  {
    id: 'publish-instagram',
    retries: 3,
    concurrency: { limit: 1, key: 'event.data.userId' },
    cancelOn: [{ event: 'post/cancel', match: 'data.postId' }],
    onFailure: async ({ event, error }) => {
      const { postId } = event.data.event.data as PostRequested;
      await failPost(postId, error); // does nothing when the post already ended
    },
  },
  { event: 'post/requested' },
  async ({ event, step }) => {
    const { postId, rev } = event.data as PostRequested;
    const d = deps();

    const run = await step.run('load', () => startOfRun(postId, rev));
    if (!run) return { postId, skipped: 'replaced' };

    if (run.scheduledAtMs !== null) {
      for (let hop = 0; ; hop++) {
        const target = Math.min(run.scheduledAtMs, run.nowMs + (hop + 1) * HOP_MS);
        await step.sleepUntil(`wait-${hop}`, new Date(target));
        if (target >= run.scheduledAtMs) break;
      }
    }

    const go = await step.run('claim', () => claim(postId, rev));
    if (go !== 'go') return { postId, skipped: go };

    const containerId = await step.run('container', () => guarded(postId, () => ensureContainer(d, postId)));

    // Instagram processes the video itself; ask every 10 s at first, then every 20 s.
    let ready = false;
    for (let i = 0; i < POLL_ATTEMPTS && !ready; i++) {
      ready = (await step.run(`poll-${i}`, () => guarded(postId, () => checkContainer(d, postId, containerId)))) === 'FINISHED';
      if (!ready) await step.sleep(`poll-wait-${i}`, i < 6 ? '10s' : '20s');
    }
    if (!ready) {
      await step.run('give-up', () => failPost(postId, new Error('The video was still processing after 12 minutes.')));
      return { postId, failed: 'timeout' };
    }

    const done = await step.run('publish', () => guarded(postId, () => finish(d, postId, containerId)));
    return { postId, permalink: done.permalink };
  },
);
