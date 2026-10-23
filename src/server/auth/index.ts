import { ObjectId } from 'mongodb';
import { AppError } from '@/lib/errors';
import { db } from '@/server/db/client';
import { assertApproved, type Role } from './approved';
import { readSession } from './sessions';

export type SessionUser = { id: string; email: string; role: Role };

export async function requireUser(_req?: Request): Promise<SessionUser> {
  const session = await readSession();
  if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401);
  const user = await db().collection('users').findOne({ _id: new ObjectId(session.userId) });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401);
  // Re-check the allowlist on every request (removed members fail here).
  const role = await assertApproved(user.email).catch(() => {
    throw new AppError('NOT_APPROVED', 'Access has been removed.', 403);
  });
  return { id: String(user._id), email: user.email, role };
}

export async function requireAdmin(req?: Request): Promise<SessionUser> {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Admins only', 403);
  return user;
}
