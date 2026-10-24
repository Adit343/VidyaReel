import { cache } from 'react';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/server/auth/current-user';
import { users } from '@/server/db/collections';
import { listNotices } from '@/server/notifications';
import { getQuota } from '@/server/quota';

/** What every signed-in page needs; `cache` makes the layout and the page share one lookup per request. */
export const getAppContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const userId = new ObjectId(user.id);
  const account = await users().findOne({ _id: userId });
  const [quota, notices] = await Promise.all([
    getQuota(userId, user.email, account?.timeZone),
    listNotices(userId),
  ]);
  return { user, userId, name: account?.name ?? user.email, timeZone: account?.timeZone ?? 'Asia/Kolkata', quota, notices };
});
