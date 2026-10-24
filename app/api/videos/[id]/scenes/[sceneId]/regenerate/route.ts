import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { sceneRegenerateSchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { users } from '@/server/db/collections';
import { regenerateOneScene } from '@/server/videos/service';

export const maxDuration = 60;

// Rewrites one scene with the LLM, keeping its place. No daily-cap row.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, sceneRegenerateSchema);
    const id = new ObjectId(session.id);
    const account = await users().findOne({ _id: id });
    const { id: videoId, sceneId } = await params;
    return Response.json(await regenerateOneScene({ id, email: session.email, timeZone: account?.timeZone }, videoId, sceneId, body.version, body.instruction, req.signal));
  } catch (e) { return errorResponse(e); }
}
