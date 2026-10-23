import { errorResponse } from '@/lib/errors';
import { parseJson } from '@/server/auth/http';
import { destroySession } from '@/server/auth/sessions';

export async function POST() {
  try {
    await destroySession();
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
