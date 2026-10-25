import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { AppError, errorResponse } from '@/lib/errors';
import { VIDEO_STATUSES } from '@/lib/schemas/video';
import { requireUser } from '@/server/auth';
import { queryLibrary } from '@/server/videos/list';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(40).optional(),
});

// The member's videos, newest first: ?q= searches titles, ?status= takes one or more statuses separated by commas.
export async function GET(req: Request) {
  try {
    const session = await requireUser(req);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) throw new AppError('INVALID', 'Check the search and filter values.', 400);
    const status = parsed.data.status?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    if (status.some((s) => !(VIDEO_STATUSES as readonly string[]).includes(s))) throw new AppError('INVALID', 'Unknown status.', 400);
    const out = await queryLibrary(new ObjectId(session.id), { ...parsed.data, status: status as (typeof VIDEO_STATUSES)[number][] });
    return Response.json(out, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
