import type { ZodType } from 'zod';
import { AppError } from '@/lib/errors';

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new AppError('FORBIDDEN', 'Bad origin', 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError('INVALID', 'Invalid request', 400);
  return parsed.data;
}
