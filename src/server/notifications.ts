import { ObjectId } from 'mongodb';
import { users, videos } from '@/server/db/collections';

export type Notice = {
  id: string; kind: 'success' | 'error'; title: string; body: string; at: string; unread: boolean; href: string; retry?: boolean;
};

const WINDOW_MS = 7 * 24 * 3600e3;

/**
 * Until the notifications collection arrives (step 6.1), notices are derived from the member's own
 * videos that reached a final status in the last 7 days. "Read" is one timestamp on the user.
 */
export async function listNotices(userId: ObjectId): Promise<{ items: Notice[]; unread: number }> {
  const [account, rows] = await Promise.all([
    users().findOne({ _id: userId }, { projection: { notificationsReadAt: 1 } }),
    videos().find({
      userId, deletedAt: { $exists: false }, status: { $in: ['ready', 'failed', 'posted'] },
      updatedAt: { $gte: new Date(Date.now() - WINDOW_MS) },
    }).sort({ updatedAt: -1 }).limit(10).toArray(),
  ]);
  const readAt = account?.notificationsReadAt?.getTime() ?? 0;
  const items = rows.map((v): Notice => {
    const failed = v.status === 'failed';
    return {
      id: String(v._id), kind: failed ? 'error' : 'success', at: v.updatedAt.toISOString(),
      title: failed ? `${v.title} failed` : v.status === 'posted' ? `${v.title} was posted` : `${v.title} is ready`,
      body: failed ? (v.failureReason ?? 'The video could not be rendered.') : v.status === 'posted' ? 'Published to Instagram.' : 'Your video finished rendering.',
      unread: v.updatedAt.getTime() > readAt, href: `/videos/${v._id}`, retry: failed,
    };
  });
  return { items, unread: items.filter((n) => n.unread).length };
}

export async function markNoticesRead(userId: ObjectId) {
  await users().updateOne({ _id: userId }, { $set: { notificationsReadAt: new Date() } });
}
