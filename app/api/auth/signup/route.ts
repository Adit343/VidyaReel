import { errorResponse } from '@/lib/errors';
import { parseJson } from '@/server/auth/http';
import { signup, signupSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    await signup(await parseJson(req, signupSchema), req.headers.get('user-agent') ?? undefined);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
