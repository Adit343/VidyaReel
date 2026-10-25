import { ObjectId } from 'mongodb';
import { users } from '@/server/db/collections';
import type { SessionUser } from '@/server/auth';
import type { Owner } from './service';

/** The signed-in member as the video services want them (their time zone decides when the day's cap resets). */
export async function ownerOf(session: SessionUser): Promise<Owner> {
  const id = new ObjectId(session.id);
  const account = await users().findOne({ _id: id });
  return { id, email: session.email, timeZone: account?.timeZone };
}
