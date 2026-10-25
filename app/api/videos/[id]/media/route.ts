import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { mediaLinks } from '@/server/render/jobs';
import { loadOwned } from '@/server/videos/service';

export const dynamic = 'force-dynamic';

// Signed links (valid one hour) to play and download the finished video.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    const links = await mediaLinks(await loadOwned(new ObjectId(session.id), (await params).id));
    if (!links) throw new AppError('INVALID_STATE', 'This video has not been rendered yet.', 409);
    return Response.json(links, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
