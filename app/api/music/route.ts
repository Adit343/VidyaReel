import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { availableMusic } from '@/server/music';
import { storage } from '@/server/storage';

/** Background tracks the member can pick (docs/API-Design.md 7.2); only tracks that are in storage. */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const tracks = await availableMusic(storage());
    return Response.json({
      tracks: tracks.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, previewUrl: `/api/music/${t.id}/preview`, credit: t.credit ?? null })),
    });
  } catch (e) { return errorResponse(e); }
}
