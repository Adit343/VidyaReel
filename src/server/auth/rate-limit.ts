import { AppError } from '@/lib/errors';
import { rateLimits } from '@/server/db/collections';

export const AUTH_LIMIT = 10;
const WINDOW_MS = 60_000;

const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

/** Fixed-window counter per IP and scope; the 11th attempt in a minute throws RATE_LIMITED. */
export async function limitAuth(req: Request, scope = 'auth', limit = AUTH_LIMIT) {
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const doc = await rateLimits().findOneAndUpdate(
    { _id: `${scope}:${clientIp(req)}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + 2 * WINDOW_MS) } },
    { upsert: true, returnDocument: 'after' },
  );
  if (doc && doc.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + WINDOW_MS - Date.now()) / 1000));
    throw new AppError('RATE_LIMITED', 'Too many attempts. Try again in a minute.', 429, retryAfter);
  }
}
