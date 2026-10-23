import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { normalizeEmail } from '@/server/auth/approved';
import { approvedEmails, sessions, users, type ApprovedEmailDoc } from '@/server/db/collections';

const role = z.enum(['member', 'admin']);
const dailyLimit = z.number().int().min(1).max(100);

export const addSchema = z.object({ email: z.string().email(), role: role.optional(), dailyLimit: dailyLimit.optional() }).strict();
export const patchSchema = z.object({ role: role.optional(), dailyLimit: dailyLimit.optional() }).strict();

const defaultLimit = (r: 'member' | 'admin') => (r === 'admin' ? 20 : 5);
const isEnvAdmin = (email: string) => !!process.env.ADMIN_EMAIL && normalizeEmail(process.env.ADMIN_EMAIL) === email;

function toItem(row: ApprovedEmailDoc, hasAccount = false, lastSignInAt?: Date) {
  return {
    id: String(row._id), email: row.email, role: row.role, dailyLimit: row.dailyLimit,
    addedAt: row.addedAt, hasAccount, lastSignInAt: lastSignInAt ?? null,
  };
}

function parseId(id: string) {
  if (!ObjectId.isValid(id)) throw new AppError('NOT_FOUND', 'Member not found.', 404);
  return new ObjectId(id);
}

export async function listApproved() {
  const rows = await approvedEmails().find({ removedAt: { $exists: false } }).sort({ addedAt: 1 }).toArray();
  const accounts = await users().find({ email: { $in: rows.map((r) => r.email) } }).toArray();
  const byEmail = new Map(accounts.map((u) => [u.email, u]));
  const items = [];
  for (const row of rows) {
    const account = byEmail.get(row.email);
    const last = account ? await sessions().find({ userId: account._id }).sort({ createdAt: -1 }).limit(1).next() : null;
    items.push(toItem(row, !!account, last?.createdAt));
  }
  return items;
}

export async function addApproved(input: z.infer<typeof addSchema>, adminId: string) {
  const email = normalizeEmail(input.email);
  const r = input.role ?? 'member';
  const fields = { role: r, dailyLimit: input.dailyLimit ?? defaultLimit(r) };
  const existing = await approvedEmails().findOne({ email });
  if (existing && !existing.removedAt) throw new AppError('INVALID_STATE', 'That email is already approved.', 409);
  if (existing) {
    // Re-inviting a removed member reactivates the row.
    await approvedEmails().updateOne({ _id: existing._id }, {
      $set: { ...fields, addedBy: new ObjectId(adminId), addedAt: new Date() }, $unset: { removedAt: '' },
    });
    return toItem((await approvedEmails().findOne({ _id: existing._id }))!);
  }
  const row: Omit<ApprovedEmailDoc, '_id'> = { email, ...fields, addedBy: new ObjectId(adminId), addedAt: new Date() };
  const { insertedId } = await approvedEmails().insertOne(row as ApprovedEmailDoc);
  return toItem({ ...row, _id: insertedId });
}

export async function updateApproved(id: string, input: z.infer<typeof patchSchema>, adminId: string) {
  const _id = parseId(id);
  const row = await approvedEmails().findOne({ _id, removedAt: { $exists: false } });
  if (!row) throw new AppError('NOT_FOUND', 'Member not found.', 404);
  const self = await users().findOne({ email: row.email });
  if (input.role && input.role !== 'admin' && self && String(self._id) === adminId) {
    throw new AppError('FORBIDDEN', 'You cannot demote yourself.', 403);
  }
  if (input.role && input.role !== 'admin' && isEnvAdmin(row.email)) {
    throw new AppError('FORBIDDEN', 'The owner account stays an admin.', 403);
  }
  const set = { ...(input.role && { role: input.role }), ...(input.dailyLimit && { dailyLimit: input.dailyLimit }) };
  if (Object.keys(set).length) await approvedEmails().updateOne({ _id }, { $set: set });
  return toItem((await approvedEmails().findOne({ _id }))!);
}

/** Soft-removes: sign-in is blocked at once and every session of that member is deleted. */
export async function removeApproved(id: string, adminId: string) {
  const _id = parseId(id);
  const row = await approvedEmails().findOne({ _id, removedAt: { $exists: false } });
  if (!row) throw new AppError('NOT_FOUND', 'Member not found.', 404);
  const account = await users().findOne({ email: row.email });
  if ((account && String(account._id) === adminId) || isEnvAdmin(row.email)) {
    throw new AppError('FORBIDDEN', 'This account cannot be removed.', 403);
  }
  await approvedEmails().updateOne({ _id }, { $set: { removedAt: new Date() } });
  if (account) await sessions().deleteMany({ userId: account._id });
}
