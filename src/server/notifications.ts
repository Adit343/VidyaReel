import { ObjectId } from 'mongodb';
import { notifications, users, videos, type NotificationDoc } from '@/server/db/collections';

export type Notice = {
  id: string; kind: 'success' | 'error'; title: string; body: string; at: string; unread: boolean; href: string; retry?: boolean;
};

type Input = { userId: ObjectId; kind: NotificationDoc['kind']; refId: ObjectId; title: string; body: string; href: string; retry?: boolean };

/**
 * Stores one notice. The same event (kind + refId) is stored once, so a retried workflow step or a repeated
 * handler never shows the member the same message twice. Never throws: a notice must not break the work it reports on.
 */
export async function notify(n: Input) {
  try {
    await notifications().updateOne(
      { userId: n.userId, kind: n.kind, refId: n.refId },
      { $setOnInsert: { _id: new ObjectId(), title: n.title, body: n.body, href: n.href, retry: n.retry ?? false, createdAt: new Date() } },
      { upsert: true },
    );
  } catch (e) {
    console.error(JSON.stringify({ level: 'warn', msg: 'notify failed', kind: n.kind, error: e instanceof Error ? e.message : String(e) }));
  }
}

const titleOf = async (videoId: ObjectId) => (await videos().findOne({ _id: videoId }, { projection: { title: 1 } }))?.title ?? 'Your video';

export async function notifyRenderReady(videoId: ObjectId, userId: ObjectId) {
  await notify({ userId, kind: 'render_ready', refId: videoId, title: `${await titleOf(videoId)} is ready`, body: 'Your video finished rendering.', href: `/videos/${videoId}` });
}
export async function notifyRenderFailed(videoId: ObjectId, userId: ObjectId, reason: string) {
  await notify({ userId, kind: 'render_failed', refId: videoId, title: `${await titleOf(videoId)} failed`, body: reason, href: `/videos/${videoId}`, retry: true });
}
export async function notifyPosted(postId: ObjectId, videoId: ObjectId, userId: ObjectId) {
  await notify({ userId, kind: 'post_posted', refId: postId, title: `${await titleOf(videoId)} was posted`, body: 'Published to Instagram.', href: `/videos/${videoId}/post` });
}
export async function notifyPostFailed(postId: ObjectId, videoId: ObjectId, userId: ObjectId, reason: string) {
  await notify({ userId, kind: 'post_failed', refId: postId, title: `${await titleOf(videoId)} was not posted`, body: reason, href: `/videos/${videoId}/post`, retry: true });
}
/** Callers send this only when the connection actually changes to needs-reconnect, so each lapse notifies once. */
export async function notifyNeedsReconnect(userId: ObjectId) {
  await notify({ userId, kind: 'ig_needs_reconnect', refId: new ObjectId(), title: 'Reconnect Instagram', body: 'Your Instagram connection expired. Scheduled posts are paused until you reconnect.', href: '/settings' });
}

export async function listNotices(userId: ObjectId): Promise<{ items: Notice[]; unread: number }> {
  const [account, rows] = await Promise.all([
    users().findOne({ _id: userId }, { projection: { notificationsReadAt: 1 } }),
    notifications().find({ userId }).sort({ createdAt: -1 }).limit(10).toArray(),
  ]);
  const readAt = account?.notificationsReadAt?.getTime() ?? 0;
  const items = rows.map((r): Notice => ({
    id: String(r._id), kind: r.kind === 'render_failed' || r.kind === 'post_failed' || r.kind === 'ig_needs_reconnect' ? 'error' : 'success',
    title: r.title, body: r.body, at: r.createdAt.toISOString(), unread: r.createdAt.getTime() > readAt, href: r.href, retry: r.retry || undefined,
  }));
  // The badge counts all unread rows, not just the ten shown.
  const unread = await notifications().countDocuments({ userId, createdAt: { $gt: new Date(readAt) } });
  return { items, unread };
}

export async function markNoticesRead(userId: ObjectId) {
  await users().updateOne({ _id: userId }, { $set: { notificationsReadAt: new Date() } });
}
