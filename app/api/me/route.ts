import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { deleteMyData, updateProfile } from '@/server/account';
import { instagramConnections, users } from '@/server/db/collections';
import { getQuota } from '@/server/quota';
import { inngest } from '@/workflows/inngest';

async function profile(session: { id: string; email: string; role: string }) {
  const id = new ObjectId(session.id);
  const [user, ig] = await Promise.all([users().findOne({ _id: id }), instagramConnections().findOne({ userId: id }, { projection: { username: 1, status: 1 } })]);
  const quota = await getQuota(id, session.email, user?.timeZone);
  return {
    id: session.id, email: session.email, name: user?.name ?? session.email, role: session.role,
    timeZone: user?.timeZone ?? 'Asia/Kolkata',
    daily: { limit: quota.limit, used: quota.used, left: quota.left },
    instagram: ig ? { connected: true, username: ig.username, status: ig.status } : { connected: false, username: null, status: null },
  };
}

export async function GET(req: Request) {
  try {
    return Response.json(await profile(await requireUser(req)));
  } catch (e) { return errorResponse(e); }
}

const patchSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), timeZone: z.string().max(64).optional() }).strict();

export async function PATCH(req: Request) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, patchSchema);
    await updateProfile(new ObjectId(session.id), body);
    return Response.json(await profile(session));
  } catch (e) { return errorResponse(e); }
}

// Delete my data: needs the member to type DELETE (Settings, "Delete my data").
export async function DELETE(req: Request) {
  try {
    const session = await requireUser(req);
    await parseJson(req, z.object({ confirm: z.literal('DELETE') }).strict()).catch(() => {
      throw new AppError('VALIDATION', 'Type DELETE to confirm.', 400);
    });
    await deleteMyData(new ObjectId(session.id), { send: (name, data) => inngest.send({ name, data }) });
    return new Response(null, { status: 202 });
  } catch (e) { return errorResponse(e); }
}
