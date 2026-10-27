import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { disconnect, getConnection } from '@/server/instagram/connection';
import { inngest } from '@/workflows/inngest';

export async function GET(req: Request) {
  try {
    const session = await requireUser(req);
    return Response.json(await getConnection(new ObjectId(session.id)));
  } catch (e) { return errorResponse(e); }
}

// Deletes the connection and its token and cancels the member's scheduled posts.
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const session = await requireUser(req);
    return Response.json(await disconnect(new ObjectId(session.id), { send: (name, data) => inngest.send({ name, data }) }));
  } catch (e) { return errorResponse(e); }
}
