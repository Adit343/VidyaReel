import { errorResponse } from '@/lib/errors';
import { parseAuthJson } from '@/server/auth/http';
import { resetPassword, resetSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    await resetPassword(await parseAuthJson(req, resetSchema));
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
