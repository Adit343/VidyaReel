import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { listNotices, markNoticesRead } from '@/server/notifications';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return Response.json(await listNotices(new ObjectId(user.id)));
  } catch (e) { return errorResponse(e); }
}

/** Mark all read. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    await markNoticesRead(new ObjectId(user.id));
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
