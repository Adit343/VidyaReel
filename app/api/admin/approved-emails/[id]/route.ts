import { errorResponse } from '@/lib/errors';
import { patchSchema, removeApproved, removeSchema, updateApproved } from '@/server/admin/approved-emails';
import { requireAdmin } from '@/server/auth';
import { assertSameOrigin, parseJson } from '@/server/auth/http';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin(req);
    return Response.json(await updateApproved((await params).id, await parseJson(req, patchSchema), admin.id));
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin(req);
    const body = req.headers.get('content-length') === '0' ? {} : await req.json().catch(() => ({}));
    const parsed = removeSchema.safeParse(body);
    await removeApproved((await params).id, admin.id, parsed.success ? parsed.data : {});
    return new Response(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}
