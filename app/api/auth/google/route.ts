import { errorResponse } from '@/lib/errors';
import { startGoogle } from '@/server/auth/google';
import { limitAuth } from '@/server/auth/rate-limit';

export async function GET(req: Request) {
  try {
    await limitAuth(req);
    return Response.redirect(await startGoogle(), 302);
  } catch (e) { return errorResponse(e); }
}
