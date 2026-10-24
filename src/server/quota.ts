import type { ObjectId } from 'mongodb';
import { approvedEmails, videos } from '@/server/db/collections';

const DEFAULT_LIMIT = 5;

/** Start of the current day in `timeZone` (as a UTC instant) and the start of the next one. */
export function dayBounds(timeZone: string, now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((x) => [x.type, Number(x.value)]),
  );
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(p.year, p.month - 1, p.day) - offset);
  return { start, end: new Date(start.getTime() + 24 * 3600e3) };
}

export type Quota = { used: number; limit: number; left: number; resetsInMs: number };

/**
 * Videos created today count toward the daily cap, except failed ones (refunded) and deleted ones still count
 * (deleting must not hand the slot back).
 */
export async function getQuota(userId: ObjectId, email: string, timeZone = 'Asia/Kolkata', now = new Date()): Promise<Quota> {
  const { start, end } = dayBounds(timeZone, now);
  const [row, used] = await Promise.all([
    approvedEmails().findOne({ email, removedAt: { $exists: false } }),
    videos().countDocuments({ userId, createdAt: { $gte: start }, status: { $ne: 'failed' } }),
  ]);
  const limit = row?.dailyLimit ?? DEFAULT_LIMIT;
  return { used, limit, left: Math.max(0, limit - used), resetsInMs: end.getTime() - now.getTime() };
}

/** "7h 24m" style countdown. */
export function formatCountdown(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
