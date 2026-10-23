import { errorResponse } from '@/lib/errors';
import { parseAuthJson } from '@/server/auth/http';
import { signup, signupSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    await signup(await parseAuthJson(req, signupSchema), req.headers.get('user-agent') ?? undefined);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
