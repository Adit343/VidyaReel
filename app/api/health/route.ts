import { db } from '@/server/db/client';

export async function GET() {
  try {
    await db().command({ ping: 1 });
    return Response.json({ ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
