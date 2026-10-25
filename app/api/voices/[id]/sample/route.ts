import { AppError, errorResponse } from '@/lib/errors';
import { limitAuth } from '@/server/auth/rate-limit';
import { requireUser } from '@/server/auth';
import { storage } from '@/server/storage';
import { createElevenLabsVoice } from '@/server/voice';
import { sampleUrl } from '@/server/voice/samples';

/** 302 to a fresh signed link for the voice's sample, so a plain `<audio src>` can play it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(req);
    const { id } = await params;
    await limitAuth(req, 'voice-sample', 30);
    const url = await sampleUrl({ storage: storage(), voice: () => createElevenLabsVoice() }, id).catch(() => {
      throw new AppError('PROVIDER_UNAVAILABLE', 'The sample is not available right now.', 503);
    });
    if (!url) throw new AppError('NOT_FOUND', 'No such voice.', 404);
    return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'private, max-age=600' } });
  } catch (e) { return errorResponse(e); }
}
