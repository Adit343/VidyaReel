import { ObjectId } from 'mongodb';
import { AppError } from '@/lib/errors';
import { errorFields, log } from '@/lib/log';
import { renderJobs, usageLog, videos, type RenderJobDoc, type RenderStage, type VideoDoc } from '@/server/db/collections';
import { notifyRenderFailed } from '@/server/notifications';
import { getQuota } from '@/server/quota';
import { storage } from '@/server/storage';
import { loadOwned, type Owner } from '@/server/videos/service';
import { inngest } from '@/workflows/inngest';
import type { StorageProvider } from '@/server/providers';
import { missingVoiceChars } from './pipeline';

/** Words the Generate screen shows (API-Design 8.2). */
export const STAGE_LABEL: Record<RenderStage, string> = {
  load: 'Writing voice', voice: 'Writing voice', sync: 'Building scenes', media: 'Building scenes', props: 'Building scenes',
  render: 'Rendering video', upload: 'Finishing', finalise: 'Finishing',
};

export type JobView = {
  id: string; status: RenderJobDoc['status']; stage: RenderStage; stageLabel: string; progress: number; etaSec: number | null;
  kind: 'full' | 'fix'; attempt: number; sceneIds: string[]; error: { code: string; message: string } | null; startedAt: string | null;
  renderSec: number | null; warnings: string[];
};

export function toJobView(j: RenderJobDoc, now = new Date()): JobView {
  const active = j.status === 'queued' || j.status === 'running';
  const elapsed = j.startedAt ? (now.getTime() - j.startedAt.getTime()) / 1000 : 0;
  return {
    id: String(j._id), status: j.status, stage: j.stage, stageLabel: STAGE_LABEL[j.stage], progress: j.progress,
    // Remaining time from the pace so far; too early to say before the first few percent.
    etaSec: active && j.progress >= 8 && elapsed > 0 ? Math.max(1, Math.round((elapsed * (100 - j.progress)) / j.progress)) : null,
    kind: j.kind, attempt: j.attempt, sceneIds: j.sceneIds ?? [],
    error: j.error ? { code: j.error.code, message: j.error.message } : null,
    startedAt: j.startedAt?.toISOString() ?? null, renderSec: j.renderSec ?? null, warnings: j.warnings ?? [],
  };
}

/** Monthly ElevenLabs budget; the free plan gives about 10,000 credits (API-Design 3). */
export const monthlyVoiceCredits = () => Number(process.env.ELEVENLABS_MONTHLY_CREDITS) || 10000;

export async function voiceCreditsUsedThisMonth(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // The ElevenLabs account is shared by every member, so the budget counts everyone's usage.
  const rows = await usageLog().aggregate<{ total: number }>([
    { $match: { type: 'voice_credits', createdAt: { $gte: start } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray();
  return rows[0]?.total ?? 0;
}

export type StartDeps = { send: (name: string, data: Record<string, unknown>) => Promise<unknown>; storage: StorageProvider };
const defaultDeps = (): StartDeps => ({ send: (name, data) => inngest.send({ name, data }), storage: storage() });

export type StartInput = { version: number; sceneIds?: string[]; idempotencyKey?: string };

/**
 * Starts a render (API-Design 8.1). Order: replay by idempotency key, an already active job, state and cap checks,
 * voice budget, the job row (the unique `active` index is the lock), then the video lock and the Inngest event.
 */
export async function startRender(owner: Owner, videoId: string, input: StartInput, deps: StartDeps = defaultDeps()) {
  const v = await loadOwned(owner.id, videoId);
  const key = input.idempotencyKey?.slice(0, 80);

  if (key) {
    const again = await renderJobs().findOne({ userId: owner.id, idempotencyKey: key });
    if (again) {
      if (!again.videoId.equals(v._id)) throw new AppError('INVALID', 'That Idempotency-Key was used for another video.', 400);
      return { job: toJobView(again), replay: true, created: false };
    }
  }
  const running = await renderJobs().findOne({ videoId: v._id, active: true });
  if (running) return { job: toJobView(running), replay: false, created: false };

  if (v.status === 'draft' || !v.scenes.length) throw new AppError('INVALID_STATE', 'Write the script first.', 409);
  if (v.status === 'posted' || v.status === 'scheduled') throw new AppError('INVALID_STATE', 'This video is already posted or scheduled.', 409);
  if (v.version !== input.version) throw new AppError('VERSION_CONFLICT', 'This video changed elsewhere. Reload to see the latest.', 409);
  const sceneIds = input.sceneIds?.length ? [...new Set(input.sceneIds)] : undefined;
  if (sceneIds?.some((id) => !v.scenes.some((s) => s.id === id))) throw new AppError('INVALID', 'Unknown scene.', 400);

  if (v.status === 'failed') {
    // A failed video was refunded; trying again takes a slot again, so it needs one to be free.
    const quota = await getQuota(owner.id, owner.email, owner.timeZone);
    if (quota.left <= 0) throw new AppError('DAILY_LIMIT', `You have used all ${quota.limit} videos today.`, 429);
  }
  const needChars = await missingVoiceChars(deps, v);
  if (needChars > 0 && (await voiceCreditsUsedThisMonth()) + needChars > monthlyVoiceCredits()) {
    throw new AppError('VOICE_CREDITS_LOW', 'The free voice budget for this month is used up. Try again next month.', 429);
  }

  const kind = sceneIds && v.status === 'ready' ? 'fix' : 'full';
  const attempt = (await renderJobs().countDocuments({ videoId: v._id })) + 1;
  const job: RenderJobDoc = {
    _id: new ObjectId(), videoId: v._id, userId: owner.id, kind, ...(kind === 'fix' ? { sceneIds } : {}), status: 'queued', stage: 'load',
    progress: 0, attempt, active: true, ...(key ? { idempotencyKey: key } : {}), queuedAt: new Date(),
  };
  try {
    await renderJobs().insertOne(job);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      const other = await renderJobs().findOne({ videoId: v._id, active: true });
      if (other) return { job: toJobView(other), replay: false, created: false };
    }
    throw e;
  }

  const locked = await videos().findOneAndUpdate(
    { _id: v._id, userId: owner.id, version: v.version, deletedAt: { $exists: false } },
    { $set: { status: 'rendering', currentJobId: job._id, updatedAt: new Date() }, $inc: { version: 1 }, $unset: { failureReason: '' } },
  );
  if (!locked) {
    await renderJobs().deleteOne({ _id: job._id });
    throw new AppError('VERSION_CONFLICT', 'This video changed elsewhere. Reload to see the latest.', 409);
  }
  try {
    await deps.send('video/render.requested', { videoId: String(v._id), jobId: String(job._id), userId: String(owner.id), ...(sceneIds ? { sceneIds } : {}) });
  } catch {
    // The workflow service is unreachable: undo the lock so the member can try again.
    await renderJobs().deleteOne({ _id: job._id });
    await restoreStatus(v._id, v.outputKey, v.status === 'failed' ? 'failed' : 'storyboard_ready', v.failureReason);
    throw new AppError('PROVIDER_UNAVAILABLE', 'The video service is not reachable right now. Try again in a moment.', 503);
  }
  return { job: toJobView(job), replay: false, created: true };
}

/** After a job ends without a new video: a video with an earlier render goes back to `ready`, otherwise to `fallback`. */
async function restoreStatus(videoId: ObjectId, outputKey: string | undefined, fallback: 'storyboard_ready' | 'failed' = 'storyboard_ready', reason?: string) {
  const status = outputKey ? 'ready' : fallback;
  await videos().updateOne(
    { _id: videoId, status: 'rendering' },
    { $set: { status, updatedAt: new Date(), ...(reason && status === 'failed' ? { failureReason: reason } : {}) }, $inc: { version: 1 }, $unset: { currentJobId: '' } },
  );
}

export async function latestJob(videoId: ObjectId) {
  return renderJobs().find({ videoId }).sort({ queuedAt: -1 }).limit(1).next();
}

/** Signed links to the finished video and its poster frame; null until a render has succeeded. */
export async function mediaLinks(v: VideoDoc, st: StorageProvider = storage(), ttlSec = 3600) {
  if (!v.outputKey) return null;
  const name = `${(v.title || 'video').replace(/[^\w .()-]/g, '').trim().slice(0, 60) || 'video'}.mp4`;
  return {
    videoUrl: await st.signedGet(v.outputKey, ttlSec),
    thumbUrl: v.thumbKey ? await st.signedGet(v.thumbKey, ttlSec) : null,
    downloadUrl: await st.signedGet(v.outputKey, ttlSec, { downloadName: name }),
    expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
}

/** Polled by the Generate screen (API-Design 8.2). */
export async function getRenderStatus(userId: ObjectId, videoId: string, st: StorageProvider = storage()) {
  const v = await loadOwned(userId, videoId);
  const job = await latestJob(v._id);
  const succeeded = v.status === 'ready' || v.status === 'scheduled' || v.status === 'posted';
  return {
    videoStatus: v.status, version: v.version,
    job: job ? toJobView(job) : null,
    media: succeeded ? await mediaLinks(v, st).catch(() => null) : null,
    durationSec: v.output?.durationMs ? Math.round(v.output.durationMs / 1000) : null,
  };
}

export type CancelDeps = Pick<StartDeps, 'send'> & { stopSandbox?: (name: string) => Promise<void>; storage?: StorageProvider };

/** Cancels the active render (API-Design 8.3); the script is kept, and a video with an earlier render stays ready. */
export async function cancelRender(userId: ObjectId, videoId: string, deps: CancelDeps = { send: (name, data) => inngest.send({ name, data }) }) {
  const v = await loadOwned(userId, videoId);
  const job = await renderJobs().findOneAndUpdate(
    { videoId: v._id, active: true },
    { $set: { status: 'cancelled', finishedAt: new Date() }, $unset: { active: '' } },
    { returnDocument: 'after' },
  );
  if (!job) throw new AppError('INVALID_STATE', 'There is no render to cancel.', 409);
  await restoreStatus(v._id, v.outputKey);
  await deps.send('video/render.cancel', { videoId: String(v._id), jobId: String(job._id) }).catch(() => undefined);
  if (job.sandboxId) await deps.stopSandbox?.(job.sandboxId).catch(() => undefined);
  return getRenderStatus(userId, videoId, deps.storage);
}

const REASON: Partial<Record<RenderStage, string>> = {
  load: 'We could not start the video. Please try again.',
  voice: 'The narration could not be recorded. Please try again.',
  sync: 'The narration could not be lined up with the scenes. Please try again.',
  media: 'The stock clips could not be prepared. Please try again.',
  render: 'The video could not be assembled. Please try again.',
  upload: 'The finished video could not be saved. Please try again.',
};

/** Workflow side: a job ended in error. The video becomes `failed` (refunded), or `ready` again after a failed fix. */
export async function failJob(jobId: string, error: unknown) {
  const _id = new ObjectId(jobId);
  const job = await renderJobs().findOne({ _id });
  if (!job || !job.active) return; // cancelled or finished already
  log('error', 'render failed', { jobId, videoId: String(job.videoId), stage: job.stage, ...errorFields(error) });
  const message = REASON[job.stage] ?? 'The video could not be rendered. Please try again.';
  const detail = error instanceof Error ? error.message.slice(0, 200) : undefined;
  await renderJobs().updateOne({ _id, active: true }, {
    $set: { status: 'failed', error: { code: 'RENDER_FAILED', message, step: job.stage, ...(detail ? { detail } : {}) }, finishedAt: new Date() },
    $unset: { active: '' },
  });
  const v = await videos().findOne({ _id: job.videoId });
  if (v) await restoreStatus(v._id, v.outputKey, 'failed', message);
  await notifyRenderFailed(job.videoId, job.userId, message);
}

/** Progress write from inside a step; ignored once the job was cancelled, and never moves backwards. */
export async function setProgress(jobId: string, stage: RenderStage, progress: number, extra: Partial<RenderJobDoc> = {}) {
  await renderJobs().updateOne(
    { _id: new ObjectId(jobId), active: true },
    { $set: { stage, status: 'running', ...extra }, $max: { progress: Math.min(99, Math.round(progress)) } },
  );
}
