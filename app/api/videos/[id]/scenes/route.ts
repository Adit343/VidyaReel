import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { sceneAddSchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { addScene } from '@/server/videos/service';

// Adds a blank scene for the member to write ("+ Add new scene beat").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const body = await parseJson(req, sceneAddSchema);
    return Response.json(await addScene(new ObjectId(user.id), (await params).id, body.version, body.afterSceneId), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
