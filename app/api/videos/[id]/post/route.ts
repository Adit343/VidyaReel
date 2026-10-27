import { z } from 'zod';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';
import { createPost } from '@/server/posts/service';
import { ownerOf } from '@/server/videos/owner';

const postSchema = z.object({
  caption: z.string().max(5000), scheduledAt: z.string().datetime().optional(), confirmRepost: z.boolean().optional(),
}).strict();

// Post now or schedule. A repeat with the same Idempotency-Key returns the first post.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(req);
    const body = await parseJson(req, postSchema);
    const out = await createPost(await ownerOf(session), (await params).id, { ...body, idempotencyKey: req.headers.get('idempotency-key') ?? undefined });
    return Response.json({ post: out.post }, { status: out.replay ? 200 : 202, headers: out.replay ? { 'Idempotent-Replay': 'true' } : undefined });
  } catch (e) { return errorResponse(e); }
}
