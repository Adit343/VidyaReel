import { errorFields, log } from '@/lib/log';
import { db } from '@/server/db/client';

export async function GET() {
  try {
    const t0 = Date.now();
    await db().command({ ping: 1 });
    return Response.json({ ok: true, dbMs: Date.now() - t0, version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' });
  } catch (e) {
    log('error', 'health check failed', errorFields(e));
    return Response.json({ ok: false }, { status: 503 });
  }
}
