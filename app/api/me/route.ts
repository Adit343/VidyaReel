import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { users } from '@/server/db/collections';
import { getQuota } from '@/server/quota';

export async function GET(req: Request) {
  try {
    const session = await requireUser(req);
    const user = await users().findOne({ _id: new ObjectId(session.id) });
    const quota = await getQuota(new ObjectId(session.id), session.email, user?.timeZone);
    return Response.json({
      id: session.id, email: session.email, name: user?.name ?? session.email, role: session.role,
      timeZone: user?.timeZone ?? 'Asia/Kolkata',
      daily: { limit: quota.limit, used: quota.used, left: quota.left },
    });
  } catch (e) { return errorResponse(e); }
}
