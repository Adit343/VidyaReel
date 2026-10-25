import { z } from 'zod';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { startRender } from '@/server/render/jobs';
import { ownerOf } from '@/server/videos/owner';

const renderSchema = z.object({ version: z.number().int(), sceneIds: z.array(z.string()).max(12).optional() }).strict();

// Locks the storyboard and starts the render workflow. A repeat with the same Idempotency-Key, or a second press
// while a job is active, returns that job instead of starting another.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, renderSchema);
    const out = await startRender(await ownerOf(session), (await params).id, { ...body, idempotencyKey: req.headers.get('idempotency-key') ?? undefined });
    return Response.json({ job: out.job }, { status: out.created ? 202 : 200, headers: out.replay ? { 'Idempotent-Replay': 'true' } : undefined });
  } catch (e) { return errorResponse(e); }
}
