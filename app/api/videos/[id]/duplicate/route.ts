import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { ownerOf } from '@/server/videos/owner';
import { duplicateVideo } from '@/server/videos/service';

// A copy of the script and settings as a new storyboard-ready video. Counts toward the daily cap.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const session = await requireUser(req);
    return Response.json(await duplicateVideo(await ownerOf(session), (await params).id), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
