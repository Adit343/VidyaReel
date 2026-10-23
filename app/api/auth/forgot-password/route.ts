import { errorResponse } from '@/lib/errors';
import { parseAuthJson } from '@/server/auth/http';
import { forgotPassword, forgotSchema } from '@/server/auth/service';

export async function POST(req: Request) {
  try {
    const { email } = await parseAuthJson(req, forgotSchema);
    await forgotPassword(email).catch(() => undefined); // never reveal whether the email exists
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
