import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { approvedEmails, users } from '@/server/db/collections';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
  try {
    const session = await requireUser(req);
    const [user, approved] = await Promise.all([
      users().findOne({ _id: new ObjectId(session.id) }),
      approvedEmails().findOne({ email: session.email, removedAt: { $exists: false } }),
    ]);
    const limit = approved?.dailyLimit ?? 5;
    // `used` is wired to usage_log in phase 2 (step 2.10); until then nothing has been counted.
    return Response.json({
      id: session.id, email: session.email, name: user?.name ?? session.email, role: session.role,
      timeZone: user?.timeZone ?? 'Asia/Kolkata',
      daily: { limit, used: 0, left: limit },
    });
  } catch (e) { return errorResponse(e); }
}
