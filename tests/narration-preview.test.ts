import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { VOICES } from '@/config/voices';
import type { AppError } from '@/lib/errors';
import { videos } from '@/server/db/collections';
import type { StorageProvider, VoiceProvider } from '@/server/providers';
import { narrationPreviewUrl } from '@/server/voice/preview';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);

function fakes() {
  const files = new Map<string, Buffer>();
  const spoken: { text: string; voiceId: string; speed: number }[] = [];
  const storage: StorageProvider = {
    put: async (k, b) => { files.set(k, b); },
    list: async () => [], deletePrefix: async () => 0, exists: async (k) => files.has(k),
    signedGet: async (k) => `https://signed.example/${k}`,
    delete: async (k) => { files.delete(k); },
  };
  const voice: VoiceProvider = {
    synthesize: async (text, o) => { spoken.push({ text, ...o }); return { audio: Buffer.from('mp3'), durationMs: 4000, words: [], credits: text.length }; },
  };
  return { files, spoken, deps: { storage, voice: () => voice } };
}

async function video(narration = 'Plants make food from sunlight.') {
  const userId = new ObjectId();
  const _id = new ObjectId();
  await videos().insertOne({ _id, userId, title: 'T', version: 1, status: 'storyboard_ready', scenes: [{ id: 's1', order: 0, narration }] } as never);
  return { userId, id: String(_id) };
}

describe('narration preview', () => {
  it('speaks the scene once per text, voice and pace, then reuses the stored audio', async () => {
    const { files, spoken, deps } = fakes();
    const v = await video();
    const a = await narrationPreviewUrl(deps, v.userId, v.id, 's1', VOICES[0].id, 1);
    const b = await narrationPreviewUrl(deps, v.userId, v.id, 's1', VOICES[0].id, 1);
    expect(a).toBe(b);
    expect(a).toContain(`videos/${v.id}/preview/`);
    expect(spoken).toEqual([{ text: 'Plants make food from sunlight.', voiceId: VOICES[0].id, speed: 1 }]);
    await narrationPreviewUrl(deps, v.userId, v.id, 's1', VOICES[1].id, 1);
    await narrationPreviewUrl(deps, v.userId, v.id, 's1', VOICES[0].id, 1.1);
    expect(spoken).toHaveLength(3);
    expect(files.size).toBe(3);
  });

  it('refuses another member, an unknown scene, an unknown voice or empty narration without calling the provider', async () => {
    const { spoken, deps } = fakes();
    const v = await video();
    expect(await code(narrationPreviewUrl(deps, new ObjectId(), v.id, 's1', VOICES[0].id, 1))).toBe('NOT_FOUND');
    expect(await code(narrationPreviewUrl(deps, v.userId, v.id, 'nope', VOICES[0].id, 1))).toBe('NOT_FOUND');
    expect(await code(narrationPreviewUrl(deps, v.userId, v.id, 's1', 'not-a-voice', 1))).toBe('INVALID');
    const empty = await video('   ');
    expect(await code(narrationPreviewUrl(deps, empty.userId, empty.id, 's1', VOICES[0].id, 1))).toBe('INVALID');
    expect(spoken).toEqual([]);
  });
});
