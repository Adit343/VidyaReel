import type { ObjectId } from 'mongodb';
import { VOICES } from '@/config/voices';
import { AppError } from '@/lib/errors';
import { narrationHash } from '@/server/render/pipeline';
import type { StorageProvider, VoiceProvider } from '@/server/providers';
import { storageKey } from '@/server/storage/keys';
import { loadOwned } from '@/server/videos/service';

/**
 * Link to the scene's narration spoken in the chosen voice and pace, for the Review screen. The first request for a
 * given text, voice and pace speaks it (about one ElevenLabs credit per character) and keeps the audio in storage;
 * the same request again, and every later one, is free. Only voices in `VOICES` are accepted.
 */
export async function narrationPreviewUrl(
  deps: { storage: StorageProvider; voice: () => VoiceProvider },
  userId: ObjectId, videoId: string, sceneId: string, voiceId: string, speed: number, ttlSec = 3600,
): Promise<string> {
  const video = await loadOwned(userId, videoId);
  const scene = video.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new AppError('NOT_FOUND', 'Scene not found.', 404);
  if (!VOICES.some((v) => v.id === voiceId)) throw new AppError('INVALID', 'Unknown voice.', 400);
  const text = scene.narration.trim();
  if (!text) throw new AppError('INVALID', 'This scene has no narration yet.', 400);
  const key = storageKey.narrationPreview(videoId, narrationHash(text, voiceId, speed));
  if (!(await deps.storage.exists(key))) {
    const { audio } = await deps.voice().synthesize(text, { voiceId, speed });
    await deps.storage.put(key, audio, 'audio/mpeg');
  }
  return deps.storage.signedGet(key, ttlSec);
}
