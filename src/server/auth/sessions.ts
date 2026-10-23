import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { db } from '@/server/db/client';
import { hashToken, newToken } from './tokens';

export const SESSION_COOKIE = 'vr_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: ObjectId, userAgent?: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db().collection('sessions').insertOne({
    userId, tokenHash: hashToken(token), expiresAt, userAgent, createdAt: new Date(),
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt,
  });
}

export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db().collection('sessions').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  // Sliding expiry.
  await db().collection('sessions').updateOne({ _id: session._id }, { $set: { expiresAt: new Date(Date.now() + SESSION_MS) } });
  return session as unknown as { _id: ObjectId; userId: ObjectId };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().collection('sessions').deleteOne({ tokenHash: hashToken(token) });
  jar.delete(SESSION_COOKIE);
}

export const destroyAllSessions = (userId: ObjectId) => db().collection('sessions').deleteMany({ userId });
