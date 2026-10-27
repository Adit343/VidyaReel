import { ObjectId } from 'mongodb';
import { AppError } from '@/lib/errors';
import { instagramConnections, posts, videos, type PostDoc, type VideoDoc } from '@/server/db/collections';
import { loadOwned, type Owner } from '@/server/videos/service';
import { inngest } from '@/workflows/inngest';

export const MAX_CAPTION = 2200;
export const MAX_HASHTAGS = 30;
/** Instagram's own limits for a Reel (docs/System-Design.md 8.3). */
export const MAX_BYTES = 100 * 1024 * 1024;
export const MIN_MS = 5_000;
export const MAX_MS = 90_000;
/** How far ahead a post may be scheduled. */
export const MAX_AHEAD_MS = 60 * 24 * 3600e3;

export type Send = (name: string, data: Record<string, unknown>) => Promise<unknown>;
export type PostDeps = { send: Send };
const defaultDeps = (): PostDeps => ({ send: (name, data) => inngest.send({ name, data }) });

/** The Post object of API-Design 11.2. */
export type PostView = {
  id: string; videoId: string; status: PostDoc['status']; mode: PostDoc['mode']; scheduledAt: string | null; caption: string;
  permalink: string | null; error: { code: string; message: string } | null; lateByMs: number | null; retryCount: number; paused: boolean;
  /** While publishing: `sending` until Instagram has the video, then `processing`. */
  stage: 'sending' | 'processing' | null; createdAt: string; updatedAt: string;
};

export const toPostView = (p: PostDoc): PostView => ({
  id: String(p._id), videoId: String(p.videoId), status: p.status, mode: p.mode, scheduledAt: p.scheduledAt?.toISOString() ?? null,
  caption: p.caption, permalink: p.permalink || null, error: p.error ?? null, lateByMs: p.lateByMs ?? null, retryCount: p.retryCount,
  paused: !!p.paused && p.status === 'scheduled',
  stage: p.status === 'publishing' ? (p.containerId ? 'processing' : 'sending') : null, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
});

/** Instagram allows 2,200 characters and 30 hashtags. */
export function assertCaption(caption: string) {
  if (caption.length > MAX_CAPTION) throw new AppError('VALIDATION', `The caption is ${caption.length - MAX_CAPTION} characters over Instagram's ${MAX_CAPTION} limit.`, 400);
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (tags > MAX_HASHTAGS) throw new AppError('VALIDATION', `Instagram allows at most ${MAX_HASHTAGS} hashtags; this caption has ${tags}.`, 400);
}

/** The finished file must meet Instagram's size and length limits before posting is offered. */
export function assertPostable(v: VideoDoc) {
  const o = v.output;
  if (!v.outputKey || !o) throw new AppError('VIDEO_NOT_POSTABLE', 'This video has not been rendered yet.', 409);
  const tooBig = o.sizeBytes > MAX_BYTES;
  const badLength = o.durationMs !== undefined && (o.durationMs < MIN_MS || o.durationMs > MAX_MS);
  if (tooBig || badLength) {
    throw new AppError('VIDEO_NOT_POSTABLE', tooBig
      ? 'The video file is over Instagram\'s 100 MB limit. Download it, or make a shorter video.'
      : 'Instagram Reels must be between 5 and 90 seconds long.', 409);
  }
}

export async function loadPost(userId: ObjectId, id: string) {
  const p = ObjectId.isValid(id) ? await posts().findOne({ _id: new ObjectId(id), userId }) : null;
  if (!p) throw new AppError('NOT_FOUND', 'Post not found.', 404);
  return p;
}

export async function getPost(userId: ObjectId, id: string) {
  return toPostView(await loadPost(userId, id));
}

/** The newest post of a video, if any (the Post screen opens on it). */
export async function latestPost(userId: ObjectId, videoId: ObjectId) {
  const p = await posts().find({ userId, videoId }).sort({ createdAt: -1 }).limit(1).next();
  return p ? toPostView(p) : null;
}

/**
 * Puts the video's status in line with its posts after one changed: a live post means `scheduled`, otherwise a posted
 * one means `posted`, otherwise `ready`. Only touches videos that are in one of those three states.
 */
export async function settleVideoStatus(videoId: ObjectId) {
  const [live, done] = await Promise.all([
    posts().findOne({ videoId, live: true }, { projection: { _id: 1 } }),
    posts().findOne({ videoId, status: 'posted' }, { projection: { _id: 1 } }),
  ]);
  const status = live ? 'scheduled' : done ? 'posted' : 'ready';
  await videos().updateOne(
    { _id: videoId, status: { $in: ['ready', 'scheduled', 'posted'] }, deletedAt: { $exists: false } },
    { $set: { status, updatedAt: new Date() }, $inc: { version: 1 } },
  );
}

const futureOrThrow = (iso: string, now = Date.now()) => {
  const at = new Date(iso);
  if (at.getTime() <= now) throw new AppError('SCHEDULE_IN_PAST', 'Pick a time in the future, or post now.', 400);
  if (at.getTime() > now + MAX_AHEAD_MS) throw new AppError('VALIDATION', 'You can schedule up to 60 days ahead.', 400);
  return at;
};

export type CreatePostInput = { caption: string; scheduledAt?: string; confirmRepost?: boolean; idempotencyKey?: string };

/**
 * Post now or schedule (API-Design 11.1). Order: replay by idempotency key, video state, repeat-post warning,
 * Instagram connection, caption, time, then the post row (the unique `live` index is the lock) and the event.
 */
export async function createPost(owner: Owner, videoId: string, input: CreatePostInput, deps: PostDeps = defaultDeps()) {
  const v = await loadOwned(owner.id, videoId);
  const key = input.idempotencyKey?.slice(0, 80);
  if (key) {
    const again = await posts().findOne({ userId: owner.id, idempotencyKey: key });
    if (again) {
      if (!again.videoId.equals(v._id)) throw new AppError('INVALID', 'That Idempotency-Key was used for another video.', 400);
      return { post: toPostView(again), replay: true };
    }
  }
  const live = await posts().findOne({ videoId: v._id, live: true });
  if (live || v.status === 'scheduled') throw new AppError('INVALID_STATE', 'This video already has a post in progress.', 409);
  if (v.status !== 'ready' && v.status !== 'posted') throw new AppError('INVALID_STATE', 'Finish the video before posting it.', 409);
  assertPostable(v);
  if (v.status === 'posted' && !input.confirmRepost) {
    const last = await posts().find({ videoId: v._id, status: 'posted' }).sort({ updatedAt: -1 }).limit(1).next();
    throw new AppError('ALREADY_POSTED', 'This video was already posted. Post it again?', 409, undefined, last ? { postedAt: last.updatedAt.toISOString() } : undefined);
  }

  const conn = await instagramConnections().findOne({ userId: owner.id });
  if (!conn) throw new AppError('IG_NOT_CONNECTED', 'Connect your Instagram account first, or download the video and post it yourself.', 409);
  if (conn.status === 'needs_reconnect') throw new AppError('IG_NEEDS_RECONNECT', 'Your Instagram connection expired. Reconnect to post.', 409);

  const caption = input.caption.trim();
  assertCaption(caption);
  const scheduledAt = input.scheduledAt ? futureOrThrow(input.scheduledAt) : undefined;

  const now = new Date();
  const post: PostDoc = {
    _id: new ObjectId(), videoId: v._id, userId: owner.id, connectionId: conn._id, caption, mode: scheduledAt ? 'scheduled' : 'now',
    ...(scheduledAt ? { scheduledAt } : {}), status: scheduledAt ? 'scheduled' : 'publishing', retryCount: 0, live: true, rev: 1,
    ...(key ? { idempotencyKey: key } : {}), createdAt: now, updatedAt: now,
  };
  try {
    await posts().insertOne(post);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new AppError('INVALID_STATE', 'This video already has a post in progress.', 409);
    throw e;
  }
  await settleVideoStatus(v._id);
  await start(post, deps);
  return { post: toPostView(post), replay: false };
}

/** Sends the workflow event; if the workflow service is unreachable the post is undone so the member can try again. */
async function start(post: PostDoc, deps: PostDeps, undo?: () => Promise<void>) {
  try {
    await deps.send('post/requested', { postId: String(post._id), userId: String(post.userId), rev: post.rev });
  } catch {
    if (undo) await undo();
    else await posts().deleteOne({ _id: post._id });
    await settleVideoStatus(post.videoId);
    throw new AppError('PROVIDER_UNAVAILABLE', 'The posting service is not reachable right now. Try again in a moment.', 503);
  }
}

/** Reschedule or cancel a scheduled post (API-Design 11.3). Once it is publishing it can no longer be changed. */
export async function updatePost(userId: ObjectId, id: string, change: { scheduledAt: string } | { cancel: true }, deps: PostDeps = defaultDeps()) {
  const p = await loadPost(userId, id);
  if (p.status !== 'scheduled') throw new AppError('INVALID_STATE', 'This post is already being published, so it cannot be changed.', 409);

  if ('cancel' in change) {
    const out = await posts().findOneAndUpdate(
      { _id: p._id, status: 'scheduled' },
      { $set: { status: 'cancelled', updatedAt: new Date() }, $unset: { live: '', paused: '' }, $inc: { rev: 1 } },
      { returnDocument: 'after' },
    );
    if (!out) throw new AppError('INVALID_STATE', 'This post is already being published, so it cannot be changed.', 409);
    await settleVideoStatus(p.videoId);
    // The sleeping run would stop by itself at its next check; this just ends it early.
    await deps.send('post/cancel', { postId: String(p._id) }).catch(() => undefined);
    return toPostView(out);
  }

  const at = futureOrThrow(change.scheduledAt);
  const out = await posts().findOneAndUpdate(
    { _id: p._id, status: 'scheduled' },
    { $set: { scheduledAt: at, mode: 'scheduled', updatedAt: new Date() }, $unset: { paused: '' }, $inc: { rev: 1 } },
    { returnDocument: 'after' },
  );
  if (!out) throw new AppError('INVALID_STATE', 'This post is already being published, so it cannot be changed.', 409);
  // The older run sees the new `rev` when it wakes and stops; the new run starts from the new time.
  await start(out, deps, async () => {
    await posts().updateOne({ _id: p._id }, { $set: { scheduledAt: p.scheduledAt, rev: p.rev, updatedAt: new Date() } });
  });
  return toPostView(out);
}

/** Retry a failed post (API-Design 11.4): back to `publishing`, reusing the Instagram container unless Instagram rejected it. */
export async function retryPost(userId: ObjectId, id: string, deps: PostDeps = defaultDeps()) {
  const p = await loadPost(userId, id);
  if (p.status !== 'failed') throw new AppError('INVALID_STATE', 'Only a failed post can be retried.', 409);
  const v = await loadOwned(userId, String(p.videoId));
  if (await posts().findOne({ videoId: v._id, live: true })) throw new AppError('INVALID_STATE', 'This video already has a post in progress.', 409);
  assertPostable(v);
  const conn = await instagramConnections().findOne({ userId });
  if (!conn) throw new AppError('IG_NOT_CONNECTED', 'Connect your Instagram account first.', 409);
  if (conn.status === 'needs_reconnect') throw new AppError('IG_NEEDS_RECONNECT', 'Your Instagram connection expired. Reconnect to post.', 409);

  let out: PostDoc | null;
  try {
    out = await posts().findOneAndUpdate(
      { _id: p._id, status: 'failed' },
      {
        $set: { status: 'publishing', live: true, connectionId: conn._id, updatedAt: new Date() }, $inc: { rev: 1, retryCount: 1 },
        $unset: { error: '', paused: '', ...(p.error?.code === 'IG_REJECTED' ? { containerId: '' } : {}) },
      },
      { returnDocument: 'after' },
    );
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new AppError('INVALID_STATE', 'This video already has a post in progress.', 409);
    throw e;
  }
  if (!out) throw new AppError('INVALID_STATE', 'Only a failed post can be retried.', 409);
  await settleVideoStatus(v._id);
  await start(out, deps, async () => {
    await posts().updateOne({ _id: p._id }, { $set: { status: 'failed', updatedAt: new Date() }, $unset: { live: '' } });
  });
  return toPostView(out);
}

/** Disconnect: scheduled posts cannot run without a token, so they are cancelled (API-Design 10.4). */
export async function cancelScheduledPosts(userId: ObjectId, deps: PostDeps = defaultDeps()) {
  const rows = await posts().find({ userId, status: 'scheduled' }).toArray();
  let n = 0;
  for (const p of rows) {
    const out = await posts().findOneAndUpdate(
      { _id: p._id, status: 'scheduled' },
      { $set: { status: 'cancelled', updatedAt: new Date() }, $unset: { live: '', paused: '' }, $inc: { rev: 1 } },
    );
    if (!out) continue;
    n += 1;
    await settleVideoStatus(p.videoId);
    await deps.send('post/cancel', { postId: String(p._id) }).catch(() => undefined);
  }
  return n;
}

/** The connection needs reconnecting: scheduled posts wait (System Design 8.2) and show "Paused". */
export async function pauseScheduledPosts(userId: ObjectId) {
  await posts().updateMany({ userId, status: 'scheduled' }, { $set: { paused: true, updatedAt: new Date() } });
}

/** Reconnected: paused posts start a fresh run; one whose time has passed publishes straight away and is marked late. */
export async function resumePausedPosts(userId: ObjectId, deps: PostDeps = defaultDeps()) {
  const rows = await posts().find({ userId, status: 'scheduled', paused: true }).toArray();
  for (const p of rows) {
    const out = await posts().findOneAndUpdate(
      { _id: p._id, status: 'scheduled', paused: true },
      { $unset: { paused: '' }, $set: { updatedAt: new Date() }, $inc: { rev: 1 } }, { returnDocument: 'after' },
    );
    if (out) await deps.send('post/requested', { postId: String(p._id), userId: String(userId), rev: out.rev }).catch(() => undefined);
  }
  return rows.length;
}
