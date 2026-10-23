import { errorResponse } from '@/lib/errors';
import { parseJson } from '@/server/auth/http';
import { login, loginSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    await login(await parseJson(req, loginSchema), req.headers.get('user-agent') ?? undefined);
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
