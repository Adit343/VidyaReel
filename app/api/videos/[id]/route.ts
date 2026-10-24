import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { updateVideoSchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { assertSameOrigin, parseJson } from '@/server/auth/http';
import { softDeleteVideo } from '@/server/videos/list';
import { getVideo, updateVideo } from '@/server/videos/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    return Response.json(await getVideo(new ObjectId(user.id), (await params).id));
  } catch (e) { return errorResponse(e); }
}

// Debounced autosave of settings, caption and title; `version` must match the last one the browser saw.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const body = await parseJson(req, updateVideoSchema);
    return Response.json(await updateVideo(new ObjectId(user.id), (await params).id, body));
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    if (!(await softDeleteVideo(new ObjectId(user.id), (await params).id))) throw new AppError('NOT_FOUND', 'Video not found.', 404);
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
