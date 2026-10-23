import { errorResponse } from '@/lib/errors';
import { parseJson } from '@/server/auth/http';
import { resetPassword, resetSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    await resetPassword(await parseJson(req, resetSchema));
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
