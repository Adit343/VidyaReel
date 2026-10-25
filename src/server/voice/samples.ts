import { VOICES, type VoiceOption } from '@/config/voices';
import type { StorageProvider, VoiceProvider } from '@/server/providers';
import { storageKey } from '@/server/storage/keys';

/** About five seconds of speech, so a sample costs roughly 90 ElevenLabs credits, once per voice. */
export const sampleText = (v: VoiceOption) =>
  `Hello, I am ${v.name}. Today we will learn something new together, one clear step at a time.`;

export const findVoice = (id: string) => VOICES.find((v) => v.id === id);

/**
 * Link to a voice's cached sample. The first request for a voice records the sample and keeps it in
 * storage; after that nobody pays for it again. Only voices in `VOICES` are accepted, so the credits
 * spent are bounded by the size of that list.
 */
export async function sampleUrl(
  deps: { storage: StorageProvider; voice: () => VoiceProvider },
  voiceId: string,
  ttlSec = 3600,
): Promise<string | null> {
  const v = findVoice(voiceId);
  if (!v) return null;
  const key = storageKey.voiceSample(v.id);
  if (!(await deps.storage.exists(key))) {
    const { audio } = await deps.voice().synthesize(sampleText(v), { voiceId: v.id, speed: 1 });
    await deps.storage.put(key, audio, 'audio/mpeg');
  }
  return deps.storage.signedGet(key, ttlSec);
}
