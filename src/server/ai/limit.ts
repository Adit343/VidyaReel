import type { ObjectId } from 'mongodb';
import { AppError } from '@/lib/errors';
import { rateLimits } from '@/server/db/collections';
import { LlmError } from './gemini';

export const LLM_PER_HOUR = 20;
const HOUR = 3600_000;

/** 20 AI-backed calls per member per hour (API-Design section 4); protects the Gemini free tier. */
export async function limitLlm(userId: ObjectId, limit = LLM_PER_HOUR, now = Date.now()) {
  const windowStart = Math.floor(now / HOUR) * HOUR;
  const doc = await rateLimits().findOneAndUpdate(
    { _id: `llm:${userId}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + 2 * HOUR) } },
    { upsert: true, returnDocument: 'after' },
  );
  if (doc && doc.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + HOUR - now) / 1000));
    throw new AppError('RATE_LIMITED', 'You have used a lot of AI suggestions this hour. Try again later.', 429, retryAfter);
  }
}

/** Provider trouble (down, slow, nonsense outside the retry loop) becomes a clean 503. */
export async function guardLlm<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof LlmError) throw new AppError('PROVIDER_UNAVAILABLE', 'The AI service is busy. Try again in a moment.', 503);
    throw e;
  }
}
