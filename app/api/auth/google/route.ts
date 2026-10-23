import { errorResponse } from '@/lib/errors';
import { startGoogle } from '@/server/auth/google';
import { limitAuth } from '@/server/auth/rate-limit';

export async function GET(req: Request) {
  try {
    await limitAuth(req);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return Response.redirect(new URL('/sign-in?error=GOOGLE_NOT_CONFIGURED', req.url), 302);
    }
    return Response.redirect(await startGoogle(), 302);
  } catch (e) { return errorResponse(e); }
}
