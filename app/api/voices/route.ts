import { VOICES } from '@/config/voices';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/server/auth';

/** Voices the member can pick, with a link that plays each 5 second sample (docs/API-Design.md 7.1). */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    return Response.json({
      voices: VOICES.map((v) => ({ id: v.id, name: v.name, blurb: v.blurb, sampleUrl: `/api/voices/${v.id}/sample` })),
      speeds: [0.9, 0.95, 1, 1.05, 1.1],
    });
  } catch (e) { return errorResponse(e); }
}
