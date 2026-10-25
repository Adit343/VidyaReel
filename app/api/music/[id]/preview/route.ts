import { AppError, errorResponse } from '@/lib/errors';
import { limitAuth } from '@/server/auth/rate-limit';
import { requireUser } from '@/server/auth';
import { musicUrl } from '@/server/music';
import { storage } from '@/server/storage';

/** 302 to a fresh signed link for the track, so a plain `<audio src>` can play it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(req);
    const { id } = await params;
    await limitAuth(req, 'music-preview', 60);
    const url = await musicUrl(storage(), id);
    if (!url) throw new AppError('NOT_FOUND', 'No such track.', 404);
    return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'private, max-age=600' } });
  } catch (e) { return errorResponse(e); }
}
