import { AppError } from '@/lib/errors';
import { finishGoogle } from '@/server/auth/google';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const back = (error: string) => Response.redirect(new URL(`/sign-in?error=${error}`, url.origin), 302);
  if (!code || !state) return back('invalid');
  try {
    await finishGoogle(code, state, req.headers.get('user-agent') ?? undefined);
    return Response.redirect(new URL('/', url.origin), 302);
  } catch (e) {
    return back(e instanceof AppError ? e.code : 'invalid');
  }
}
