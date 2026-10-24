import { errorResponse } from '@/lib/errors';
import { getUsage } from '@/server/admin/usage';
import { requireAdmin } from '@/server/auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    return Response.json(await getUsage());
  } catch (e) { return errorResponse(e); }
}
