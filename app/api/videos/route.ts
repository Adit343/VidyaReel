import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { createVideoSchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { users } from '@/server/db/collections';
import { createVideo } from '@/server/videos/service';

export const maxDuration = 60;

// Creates the video and writes its storyboard in one call. Counts toward the daily cap.
export async function POST(req: Request) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, createVideoSchema);
    const id = new ObjectId(session.id);
    const account = await users().findOne({ _id: id });
    const video = await createVideo({ id, email: session.email, timeZone: account?.timeZone }, body);
    return Response.json(video, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
