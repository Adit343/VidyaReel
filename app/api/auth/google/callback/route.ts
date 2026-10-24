import { AppError } from '@/lib/errors';
import { finishGoogle } from '@/server/auth/google';
import { limitAuth } from '@/server/auth/rate-limit';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const back = (error: string, email?: string) =>
    Response.redirect(new URL(`/sign-in?${new URLSearchParams({ error, ...(email ? { email } : {}) })}`, url.origin), 302);
  if (!code || !state) return back('invalid');
  try {
    await limitAuth(req);
    await finishGoogle(code, state, req.headers.get('user-agent') ?? undefined);
    return Response.redirect(new URL('/', url.origin), 302);
  } catch (e) {
    return back(e instanceof AppError ? e.code : 'invalid', e instanceof AppError ? (e.details?.email as string | undefined) : undefined);
  }
}
