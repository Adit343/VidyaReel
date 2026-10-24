import { errorResponse } from '@/lib/errors';
import { addApproved, addSchema, listApproved } from '@/server/admin/approved-emails';
import { requireAdmin } from '@/server/auth';
import { parseJson } from '@/server/auth/http';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    return Response.json({ items: await listApproved({ includeRemoved: true }) });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    return Response.json(await addApproved(await parseJson(req, addSchema), admin.id), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
