import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { versionOnlySchema } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { users } from '@/server/db/collections';
import { regenerateVideo } from '@/server/videos/service';

export const maxDuration = 60;

// New storyboard for the same inputs. No second daily-cap row.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    const { version } = await parseJson(req, versionOnlySchema);
    const id = new ObjectId(session.id);
    const account = await users().findOne({ _id: id });
    return Response.json(await regenerateVideo({ id, email: session.email, timeZone: account?.timeZone }, (await params).id, version));
  } catch (e) { return errorResponse(e); }
}
