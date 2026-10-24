import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { ideasAnglesSchema } from '@/lib/schemas/video';
import { getLlm } from '@/server/ai';
import { guardLlm, limitLlm } from '@/server/ai/limit';
import { suggestAngles } from '@/server/ai/storyboard';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';

export const maxDuration = 30;

// Three angles and a suggested hook for a topic (optional step).
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { topic } = await parseJson(req, ideasAnglesSchema);
    await limitLlm(new ObjectId(user.id));
    return Response.json({ angles: await guardLlm(() => suggestAngles(getLlm(), topic)) });
  } catch (e) { return errorResponse(e); }
}
