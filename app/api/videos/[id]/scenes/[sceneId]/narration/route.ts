import { ObjectId } from 'mongodb';
import { AppError, errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';
import { limitAuth } from '@/server/auth/rate-limit';
import { storage } from '@/server/storage';
import { createElevenLabsVoice } from '@/server/voice';
import { narrationPreviewUrl } from '@/server/voice/preview';

export const maxDuration = 30;

/**
 * 302 to a signed link for the scene's narration in the voice and pace on screen (`?voiceId=...&speed=1`), so a plain
 * `<audio src>` can play it. Costs ElevenLabs credits only the first time a text, voice and pace is heard.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const user = await requireUser(req);
    const { id, sceneId } = await params;
    const q = new URL(req.url).searchParams;
    const voiceId = q.get('voiceId') ?? '';
    const speed = Number(q.get('speed') ?? 1);
    if (!(speed >= 0.8 && speed <= 1.2)) throw new AppError('INVALID', 'Invalid speed.', 400);
    await limitAuth(req, 'narration-preview', 40);
    const url = await narrationPreviewUrl({ storage: storage(), voice: () => createElevenLabsVoice() }, new ObjectId(user.id), id, sceneId, voiceId, speed)
      .catch((e) => {
        if (e instanceof AppError) throw e;
        throw new AppError('PROVIDER_UNAVAILABLE', 'The narration is not available right now.', 503);
      });
    return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
