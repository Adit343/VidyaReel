import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { getRenderStatus } from '@/server/render/jobs';

export const dynamic = 'force-dynamic';

// Polled every 3 seconds by the Generate screen while a render is queued or running.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    return Response.json(await getRenderStatus(new ObjectId(session.id), (await params).id), { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
