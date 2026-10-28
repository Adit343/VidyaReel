import { errorResponse } from '@/lib/errors';
import { assertSameOrigin } from '@/server/auth/http';
import { destroySession } from '@/server/auth/sessions';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await destroySession();
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
