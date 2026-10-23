import { cache } from 'react';
import { requireUser, type SessionUser } from './index';

/** For server components: the signed-in approved user, or null (never throws). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try { return await requireUser(); } catch { return null; }
});
