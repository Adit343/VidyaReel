import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { db } from '@/server/db/client';
import { emailProvider } from '@/server/email';
import { assertApproved, normalizeEmail } from './approved';
import { checkPassword } from '@/lib/password-rules';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroyAllSessions } from './sessions';
import { hashToken, newToken } from './tokens';

const RESET_MS = 60 * 60 * 1000;
const users = () => db().collection('users');

export const signupSchema = z.object({
  email: z.string().email(), name: z.string().min(1).max(100), password: z.string(),
}).strict();
export const loginSchema = z.object({ email: z.string().email(), password: z.string(), remember: z.boolean().optional() }).strict();
export const forgotSchema = z.object({ email: z.string().email() }).strict();
export const resetSchema = z.object({ token: z.string().min(1), password: z.string() }).strict();

function assertStrong(password: string, email = '') {
  const check = checkPassword(password, email);
  if (check.status === 'empty' || check.status === 'short' || check.status === 'common' || check.status === 'email') {
    throw new AppError('WEAK_PASSWORD', check.status === 'empty' ? 'Enter a password.' : check.message, 400);
  }
}

export async function signup(input: z.infer<typeof signupSchema>, userAgent?: string) {
  const email = normalizeEmail(input.email);
  await assertApproved(email);
  assertStrong(input.password, email);
  if (await users().findOne({ email })) throw new AppError('EMAIL_EXISTS', 'An account already exists.', 409);
  const now = new Date();
  const { insertedId } = await users().insertOne({
    email, name: input.name, passwordHash: await hashPassword(input.password),
    timeZone: 'Asia/Kolkata', createdAt: now, updatedAt: now,
  });
  await createSession(insertedId, userAgent);
}

export async function login(input: z.infer<typeof loginSchema>, userAgent?: string) {
  const email = normalizeEmail(input.email);
  const user = await users().findOne({ email });
  const ok = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !ok) throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
  await assertApproved(email);
  await createSession(user._id, userAgent, input.remember ?? true);
}

/** Always resolves; callers answer 200 regardless so emails cannot be enumerated. */
export async function forgotPassword(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await users().findOne({ email });
  if (!user) return;
  try { await assertApproved(email); } catch { return; }
  const resets = db().collection('password_resets');
  await resets.deleteMany({ userId: user._id, usedAt: { $exists: false } });
  const token = newToken();
  await resets.insertOne({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MS) });
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;
  await emailProvider.send({
    to: email, subject: 'Reset your Vidyareel password',
    text: `Use this link within one hour to set a new password:\n${link}`,
  });
}

export async function resetPassword(input: z.infer<typeof resetSchema>) {
  const resets = db().collection('password_resets');
  const reset = await resets.findOne({ tokenHash: hashToken(input.token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!reset) throw new AppError('INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.', 400);
  assertStrong(input.password, (await users().findOne({ _id: reset.userId }))?.email);
  await users().updateOne({ _id: reset.userId }, { $set: { passwordHash: await hashPassword(input.password), updatedAt: new Date() } });
  await resets.updateOne({ _id: reset._id }, { $set: { usedAt: new Date() } });
  await destroyAllSessions(reset.userId);
}
