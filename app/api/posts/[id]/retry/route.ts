import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { retryPost } from '@/server/posts/service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const session = await requireUser(req);
    return Response.json(await retryPost(new ObjectId(session.id), (await params).id), { status: 202 });
  } catch (e) { return errorResponse(e); }
}
