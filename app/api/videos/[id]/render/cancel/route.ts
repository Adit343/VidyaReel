import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { cancelRender } from '@/server/render/jobs';
import { stopSandbox } from '@/server/render/sandbox';
import { inngest } from '@/workflows/inngest';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const session = await requireUser(req);
    return Response.json(await cancelRender(new ObjectId(session.id), (await params).id, { send: (name, data) => inngest.send({ name, data }), stopSandbox }));
  } catch (e) { return errorResponse(e); }
}
