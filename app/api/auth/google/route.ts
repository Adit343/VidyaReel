import { errorResponse } from '@/lib/errors';
import { startGoogle } from '@/server/auth/google';

export async function GET() {
  try {
    return Response.redirect(await startGoogle(), 302);
  } catch (e) { return errorResponse(e); }
}
