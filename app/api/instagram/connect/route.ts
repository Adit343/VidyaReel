import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { appBase, startConnect } from '@/server/instagram/connection';

// A normal browser navigation, not fetch: the member goes on to Meta's page. Signed-out visitors go to sign-in.
export async function GET(req: Request) {
  try {
    const session = await requireUser(req).catch((e) => {
      if (e instanceof AppError && e.status === 401) return null;
      throw e;
    });
    if (!session) return Response.redirect(new URL('/sign-in', appBase(req)), 302);
    const url = await startConnect(new ObjectId(session.id), new URL(req.url).searchParams.get('returnTo'));
    return Response.redirect(url, 302);
  } catch (e) { return errorResponse(e); }
}
