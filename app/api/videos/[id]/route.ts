import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { assertSameOrigin } from '@/server/auth/http';
import { softDeleteVideo } from '@/server/videos/list';

type Ctx = { params: Promise<{ id: string }> };

// GET and PATCH arrive with phase 2 (steps 2.11 and 2.12).
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    if (!(await softDeleteVideo(new ObjectId(user.id), (await params).id))) throw new AppError('NOT_FOUND', 'Video not found.', 404);
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
