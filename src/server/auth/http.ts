import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from '@/lib/errors';
import { limitAuth } from './rate-limit';

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  // Behind a tunnel or proxy (ngrok, Vercel) the request URL can say http while the browser used https, so the
  // configured APP_URL and the forwarded host and protocol count as the same site too.
  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto');
  if (host && proto) allowed.add(`${proto.split(',')[0].trim()}://${host}`);
  if (!allowed.has(origin)) throw new AppError('FORBIDDEN', 'Bad origin', 403);
}

/** Same-origin check + zod parse for JSON bodies. */
export async function parseJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  assertSameOrigin(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError('INVALID', 'Invalid request', 400);
  return parsed.data;
}

/** Public auth endpoints: per-IP rate limit first, then parse. */
export async function parseAuthJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  await limitAuth(req);
  return parseJson(req, schema);
}
