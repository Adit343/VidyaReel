import { approvedEmails, users, videos } from '@/server/db/collections';
import { dayBounds } from '@/server/quota';

const TZ = 'Asia/Kolkata';
const DAYS = 14;
const MONTHLY_CREDITS = () => Number(process.env.ELEVENLABS_MONTHLY_CREDITS) || 10_000;

export type UsageSummary = {
  today: { videos: number; cap: number; resetsInMs: number };
  month: { videos: number; ready: number; posted: number; label: string };
  voice: { used: number | null; total: number; tracked: boolean };
  members: { email: string; role: string; total: number; avgSec: number | null; spark: number[] }[];
};

/**
 * Numbers for the Admin "Usage" tab, from the videos collection. Voice credits are not logged yet
 * (usage_log arrives with step 6.2), so the used figure is reported as unknown instead of invented.
 */
export async function getUsage(now = new Date()): Promise<UsageSummary> {
  const { start: dayStart, end: dayEnd } = dayBounds(TZ, now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sparkStart = new Date(dayStart.getTime() - (DAYS - 1) * 24 * 3600e3);

  const [members, accounts, rows] = await Promise.all([
    approvedEmails().find({ removedAt: { $exists: false } }).toArray(),
    users().find({}).toArray(),
    videos().find({ createdAt: { $gte: monthStart > sparkStart ? sparkStart : monthStart } }).toArray(),
  ]);
  const emailOf = new Map(accounts.map((u) => [String(u._id), u.email]));
  const roleOf = new Map(members.map((m) => [m.email, m.role]));

  const perMember = new Map<string, { total: number; secs: number[]; spark: number[] }>();
  let today = 0;
  let monthTotal = 0;
  let ready = 0;
  let posted = 0;
  for (const v of rows) {
    const email = emailOf.get(String(v.userId));
    if (v.createdAt >= dayStart && v.createdAt < dayEnd && v.status !== 'failed') today++;
    if (v.createdAt >= monthStart) {
      monthTotal++;
      if (v.status === 'ready' || v.status === 'scheduled' || v.status === 'posted') ready++;
      if (v.status === 'posted') posted++;
    }
    if (!email) continue;
    const m = perMember.get(email) ?? { total: 0, secs: [], spark: Array<number>(DAYS).fill(0) };
    if (v.createdAt >= monthStart) {
      m.total++;
      const ms = (v.scenes as { durationMs?: number }[]).reduce((n, s) => n + (s.durationMs ?? 0), 0);
      if (ms > 0) m.secs.push(ms / 1000);
    }
    const day = DAYS - 1 - Math.floor((dayStart.getTime() - v.createdAt.getTime() + 24 * 3600e3 - 1) / (24 * 3600e3));
    if (day >= 0 && day < DAYS) m.spark[day]++;
    perMember.set(email, m);
  }

  return {
    today: { videos: today, cap: members.reduce((n, m) => n + m.dailyLimit, 0), resetsInMs: dayEnd.getTime() - now.getTime() },
    month: { videos: monthTotal, ready, posted, label: now.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: TZ }) },
    voice: { used: null, total: MONTHLY_CREDITS(), tracked: false },
    members: [...perMember.entries()]
      .map(([email, m]) => ({
        email, role: roleOf.get(email) ?? 'member', total: m.total,
        avgSec: m.secs.length ? Math.round(m.secs.reduce((a, b) => a + b, 0) / m.secs.length) : null, spark: m.spark,
      }))
      .sort((a, b) => b.total - a.total),
  };
}
