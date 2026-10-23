import { AppError } from '@/lib/errors';
import { db } from '@/server/db/client';

export type Role = 'admin' | 'member';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** The invite-only gate. Returns the role, or throws INVITE_ONLY. */
export async function assertApproved(email: string): Promise<Role> {
  const col = db().collection('approved_emails');
  const row = await col.findOne({ email, removedAt: { $exists: false } });
  if (row) return row.role as Role;

  // First admin: ADMIN_EMAIL is accepted while the list is empty.
  const adminEmail = process.env.ADMIN_EMAIL && normalizeEmail(process.env.ADMIN_EMAIL);
  if (adminEmail && email === adminEmail && (await col.countDocuments()) === 0) {
    await col.insertOne({ email, role: 'admin', dailyLimit: 20, addedAt: new Date() });
    return 'admin';
  }
  throw new AppError('INVITE_ONLY', 'This app is invite-only.', 403);
}
