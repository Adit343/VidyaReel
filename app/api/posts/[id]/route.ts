import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { getPost, updatePost } from '@/server/posts/service';

const patchSchema = z.union([z.object({ scheduledAt: z.string().datetime() }).strict(), z.object({ cancel: z.literal(true) }).strict()]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    return Response.json(await getPost(new ObjectId(session.id), (await params).id));
  } catch (e) { return errorResponse(e); }
}

// Reschedule or cancel a scheduled post.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, patchSchema).catch(() => { throw new AppError('INVALID', 'Send a new scheduledAt, or cancel: true.', 400); });
    return Response.json(await updatePost(new ObjectId(session.id), (await params).id, body));
  } catch (e) { return errorResponse(e); }
}
