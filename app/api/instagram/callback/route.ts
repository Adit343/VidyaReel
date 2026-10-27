import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { finishConnect } from '@/server/instagram/connection';
import { inngest } from '@/workflows/inngest';

// The only GET with side effects; the one-time, user-bound state is its protection (API-Design 10.2).
export async function GET(req: Request) {
  try {
    const session = await requireUser(req).catch((e) => {
      if (e instanceof AppError && e.status === 401) return null;
      throw e;
    });
    if (!session) return Response.redirect(new URL('/sign-in', req.url), 302);
    const q = new URL(req.url).searchParams;
    const target = await finishConnect(
      new ObjectId(session.id),
      { code: q.get('code'), state: q.get('state'), error: q.get('error') },
      { send: (name, data) => inngest.send({ name, data }) },
    );
    return Response.redirect(new URL(target, req.url), 302);
  } catch (e) { return errorResponse(e); }
}
