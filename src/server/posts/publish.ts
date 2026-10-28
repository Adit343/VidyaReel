import { ObjectId } from 'mongodb';
import { instagramConnections, posts, videos, type InstagramConnectionDoc, type PostDoc } from '@/server/db/collections';
import { decryptToken } from '@/server/instagram/crypto';
import { InstagramError } from '@/server/instagram/api';
import { notifyNeedsReconnect, notifyPostFailed, notifyPosted } from '@/server/notifications';
import type { SocialPublisher, StorageProvider } from '@/server/providers';
import { pauseScheduledPosts, settleVideoStatus } from './service';

/** What the workflow steps need. Tests pass fakes; the workflow passes the real Instagram client and R2. */
export type PublishDeps = { publisher: SocialPublisher; storage: StorageProvider };

/** A post-level failure with the code the Post screen maps to Retry or Reconnect (API-Design 11.2). */
export class PostError extends Error {
  constructor(public code: 'IG_REJECTED' | 'IG_NEEDS_RECONNECT' | 'IG_NOT_CONNECTED' | 'PROVIDER_UNAVAILABLE', message: string) {
    super(message);
  }
  /** Retrying the same call cannot help, so the workflow must not. */
  get final() { return this.code !== 'PROVIDER_UNAVAILABLE'; }
}

const RECONNECT_TEXT = 'Your Instagram connection expired. Reconnect your account, then try again. Your video is safe.';

/** Instagram's answer in the words the member sees. */
export function toPostError(e: unknown): PostError {
  if (e instanceof PostError) return e;
  if (e instanceof InstagramError) {
    if (e.kind === 'auth') return new PostError('IG_NEEDS_RECONNECT', RECONNECT_TEXT);
    if (e.kind === 'rejected') return new PostError('IG_REJECTED', `Instagram did not accept the post: ${e.message.slice(0, 200)}`);
  }
  return new PostError('PROVIDER_UNAVAILABLE', 'Instagram is not responding right now. Please try again in a few minutes.');
}

export type RunStart = { scheduledAtMs: number | null; nowMs: number };

/** Is this run still the current one for the post? A reschedule, cancel or retry bumps `rev` and retires older runs. */
export async function currentRun(postId: string, rev: number): Promise<PostDoc | null> {
  const p = await posts().findOne({ _id: new ObjectId(postId) });
  return p && p.live && p.rev === rev ? p : null;
}

export async function startOfRun(postId: string, rev: number): Promise<RunStart | null> {
  const p = await currentRun(postId, rev);
  if (!p) return null;
  return { scheduledAtMs: p.mode === 'scheduled' && p.status === 'scheduled' && p.scheduledAt ? p.scheduledAt.getTime() : null, nowMs: Date.now() };
}

async function connectionOf(p: PostDoc): Promise<InstagramConnectionDoc> {
  const c = await instagramConnections().findOne({ userId: p.userId });
  if (!c) throw new PostError('IG_NOT_CONNECTED', 'Instagram is not connected, so the post could not be sent. Connect your account and try again.');
  if (c.status !== 'connected') throw new PostError('IG_NEEDS_RECONNECT', RECONNECT_TEXT);
  return c;
}

/** The token is decrypted here and never leaves the step. */
async function instagramOf(p: PostDoc) {
  const c = await connectionOf(p);
  return { igUserId: c.igUserId, accessToken: decryptToken(c) };
}

export type Claim = 'go' | 'stale' | 'paused';

/**
 * Wake-up check. A scheduled post becomes `publishing` (and is marked late if it ran well after its time); a post whose
 * connection needs reconnecting stays `scheduled` and paused until the member reconnects (System Design 8.2).
 */
export async function claim(postId: string, rev: number, now = new Date()): Promise<Claim> {
  const p = await currentRun(postId, rev);
  if (!p) return 'stale';
  const c = await instagramConnections().findOne({ userId: p.userId });
  if (p.status === 'scheduled') {
    if (c?.status === 'needs_reconnect') {
      await posts().updateOne({ _id: p._id, rev }, { $set: { paused: true, updatedAt: now } });
      return 'paused';
    }
    const late = p.scheduledAt ? now.getTime() - p.scheduledAt.getTime() : 0;
    const out = await posts().findOneAndUpdate(
      { _id: p._id, rev, live: true, status: 'scheduled' },
      { $set: { status: 'publishing', updatedAt: now, ...(late > 2 * 60_000 ? { lateByMs: late } : {}) }, $unset: { paused: '' } },
    );
    return out ? 'go' : 'stale';
  }
  return 'go';
}

/** Creates the container once and saves its id before anything else, so a retry never makes a second one. */
export async function ensureContainer(d: PublishDeps, postId: string): Promise<string> {
  const p = await posts().findOne({ _id: new ObjectId(postId) });
  if (!p) throw new PostError('PROVIDER_UNAVAILABLE', 'The post no longer exists.');
  if (p.containerId) return p.containerId;
  const v = await videos().findOne({ _id: p.videoId });
  if (!v?.outputKey) throw new PostError('IG_REJECTED', 'The video file is missing. Render the video again.');
  const conn = await instagramOf(p);
  // A one hour link: Instagram fetches the file itself, and the bucket stays private.
  const url = await d.storage.signedGet(v.outputKey, 3600);
  const id = await d.publisher.createContainer(conn, url, p.caption).catch((e) => { throw toPostError(e); });
  await posts().updateOne({ _id: p._id }, { $set: { containerId: id, updatedAt: new Date() } });
  return id;
}

export type ContainerState = 'FINISHED' | 'IN_PROGRESS';

export async function checkContainer(d: PublishDeps, postId: string, containerId: string): Promise<ContainerState> {
  const p = await posts().findOne({ _id: new ObjectId(postId) });
  if (!p) throw new PostError('PROVIDER_UNAVAILABLE', 'The post no longer exists.');
  const conn = await instagramOf(p);
  const s = await d.publisher.status(conn, containerId).catch((e) => { throw toPostError(e); });
  if (s === 'ERROR') {
    const why = await d.publisher.statusMessage(conn, containerId).catch(() => 'Instagram did not accept this video.');
    throw new PostError('IG_REJECTED', why);
  }
  return s;
}

/** Publishes the container, saves the permalink and settles the video. A step that already ran returns what it saved. */
export async function finish(d: PublishDeps, postId: string, containerId: string): Promise<{ permalink: string }> {
  const p = await posts().findOne({ _id: new ObjectId(postId) });
  if (!p) throw new PostError('PROVIDER_UNAVAILABLE', 'The post no longer exists.');
  if (p.status === 'posted') return { permalink: p.permalink ?? '' };
  const conn = await instagramOf(p);
  const r = await d.publisher.publish(conn, containerId).catch((e) => { throw toPostError(e); });
  await posts().updateOne(
    { _id: p._id },
    { $set: { status: 'posted', igMediaId: r.mediaId, permalink: r.permalink, updatedAt: new Date() }, $unset: { live: '', error: '', paused: '' } },
  );
  await settleVideoStatus(p.videoId);
  await notifyPosted(p._id, p.videoId, p.userId);
  return { permalink: r.permalink };
}

/**
 * Marks a post failed with a plain reason. Only a live post changes, so it is safe to call from both the step that saw
 * the error and the workflow's failure handler. A dead token also moves the connection to `needs_reconnect`.
 */
export async function failPost(postId: string, error: unknown) {
  const e = toPostError(error);
  const p = await posts().findOneAndUpdate(
    { _id: new ObjectId(postId), live: true },
    { $set: { status: 'failed', error: { code: e.code, message: e.message }, updatedAt: new Date() }, $unset: { live: '', paused: '' } },
  );
  if (!p) return;
  await settleVideoStatus(p.videoId);
  await notifyPostFailed(p._id, p.videoId, p.userId, e.message);
  if (e.code === 'IG_NEEDS_RECONNECT') await markNeedsReconnect(p.userId);
}

/** Token expired or revoked: reconnect needed, and the member's other scheduled posts wait. */
export async function markNeedsReconnect(userId: ObjectId) {
  const r = await instagramConnections().updateOne({ userId, status: 'connected' }, { $set: { status: 'needs_reconnect' } });
  if (r.modifiedCount) await notifyNeedsReconnect(userId);
  await pauseScheduledPosts(userId);
}
