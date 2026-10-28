import { describe, expect, it } from 'vitest';
import { VOICES } from '@/config/voices';
import { GET as listVoices } from '../app/api/voices/route';
import { signup } from '@/server/auth/service';
import type { StorageProvider, VoiceProvider } from '@/server/providers';
import { sampleText, sampleUrl } from '@/server/voice/samples';
import { approve, PASSWORD, req } from './helpers';

function fakes() {
  const files = new Map<string, Buffer>();
  const spoken: string[] = [];
  const storage: StorageProvider = {
    put: async (k, b) => { files.set(k, b); },
    deletePrefix: async () => 0, exists: async (k) => files.has(k),
    signedGet: async (k, ttl) => `https://signed.example/${k}?ttl=${ttl}`,
    delete: async (k) => { files.delete(k); },
  };
  const voice: VoiceProvider = {
    synthesize: async (text) => { spoken.push(text); return { audio: Buffer.from('mp3'), durationMs: 5000, words: [], credits: text.length }; },
  };
  return { files, spoken, deps: { storage, voice: () => voice } };
}

describe('voice samples', () => {
  it('records a voice once, keeps it in storage and signs a link for later requests', async () => {
    const { files, spoken, deps } = fakes();
    const first = await sampleUrl(deps, VOICES[0].id);
    const second = await sampleUrl(deps, VOICES[0].id, 120);
    expect(first).toContain(`voices/${VOICES[0].id}-sample.mp3`);
    expect(second).toContain('ttl=120');
    expect(spoken).toEqual([sampleText(VOICES[0])]);
    expect(files.size).toBe(1);
  });

  it('refuses a voice that is not in the list without calling the provider', async () => {
    const { spoken, deps } = fakes();
    expect(await sampleUrl(deps, 'not-a-voice')).toBeNull();
    expect(spoken).toEqual([]);
  });

  it('keeps each sample to about five seconds of speech', () => {
    for (const v of VOICES) expect(sampleText(v).length).toBeLessThan(110);
  });
});

describe('GET /api/voices', () => {
  it('needs a signed-in member, then lists the voices with their sample links', async () => {
    expect((await listVoices(req())).status).toBe(401);
    await approve('teach@example.com');
    await signup({ email: 'teach@example.com', name: 'T', password: PASSWORD });
    const res = await listVoices(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voices.map((v: { id: string }) => v.id)).toEqual(VOICES.map((v) => v.id));
    expect(body.voices[0].sampleUrl).toBe(`/api/voices/${VOICES[0].id}/sample`);
  });
});
