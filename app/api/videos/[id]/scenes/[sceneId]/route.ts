import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { sceneEditSchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { assertSameOrigin, parseJson } from '@/server/auth/http';
import { deleteScene, editScene } from '@/server/videos/service';

type Ctx = { params: Promise<{ id: string; sceneId: string }> };

// Edit narration, on-screen text or title, or move the scene (`moveTo`, 0-based).
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const body = await parseJson(req, sceneEditSchema);
    const { id, sceneId } = await params;
    return Response.json(await editScene(new ObjectId(user.id), id, sceneId, body));
  } catch (e) { return errorResponse(e); }
}

// Version goes in the query string (`?version=4`) because some clients do not send DELETE bodies.
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const version = Number(new URL(req.url).searchParams.get('version'));
    if (!Number.isInteger(version)) throw new AppError('INVALID', 'Invalid request', 400);
    const { id, sceneId } = await params;
    return Response.json(await deleteScene(new ObjectId(user.id), id, sceneId, version));
  } catch (e) { return errorResponse(e); }
}
