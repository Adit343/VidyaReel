import type { ZodType } from 'zod';
import { AppError } from '@/lib/errors';
import { limitAuth } from './rate-limit';

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new AppError('FORBIDDEN', 'Bad origin', 403);
}

/** Same-origin check + zod parse for JSON bodies. */
export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  assertSameOrigin(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError('INVALID', 'Invalid request', 400);
  return parsed.data;
}

/** Public auth endpoints: per-IP rate limit first, then parse. */
export async function parseAuthJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  await limitAuth(req);
  return parseJson(req, schema);
}
