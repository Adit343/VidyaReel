import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/errors';
import { ideasSuggestSchema } from '@/lib/schemas/video';
import { getLlm } from '@/server/ai';
import { guardLlm, limitLlm } from '@/server/ai/limit';
import { suggestIdeas } from '@/server/ai/storyboard';
import { requireUser } from '@/server/auth';
import { parseJson } from '@/server/auth/http';

export const maxDuration = 30;

// Six topic ideas. Not counted toward the daily cap, but limited to 20 AI calls per hour.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { subject, audience } = await parseJson(req, ideasSuggestSchema);
    await limitLlm(new ObjectId(user.id));
    return Response.json({ ideas: await guardLlm(() => suggestIdeas(getLlm(), subject, audience)) });
  } catch (e) { return errorResponse(e); }
}
