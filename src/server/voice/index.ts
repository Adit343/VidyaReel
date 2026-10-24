import type { VoiceProvider, Word } from '@/server/providers';

export type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/**
 * Groups ElevenLabs per-character times into words (System-Design 7.2): a word is a run of
 * non-space characters; it starts at its first character's start and ends at its last character's end.
 */
export function groupWords(a: CharAlignment): Word[] {
  const words: Word[] = [];
  let text = '';
  let startS = 0;
  let endS = 0;
  const flush = () => {
    if (text) words.push({ word: text, startMs: Math.round(startS * 1000), endMs: Math.round(endS * 1000) });
    text = '';
  };
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) return flush();
    if (!text) startS = a.character_start_times_seconds[i];
    text += ch;
    endS = a.character_end_times_seconds[i];
  });
  flush();
  return words;
}

/** Provider voice ids from `ELEVENLABS_VOICE_IDS` (comma-separated, first is the default). */
export const voiceIds = (raw = process.env.ELEVENLABS_VOICE_IDS) =>
  (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);

type TimestampResponse = { audio_base64: string; alignment: CharAlignment | null };

export class VoiceError extends Error {
  constructor(public status: number, public detail: string) {
    super(`ElevenLabs ${status}: ${detail}`);
  }
}

/** ElevenLabs `with-timestamps` text to speech, one call per scene. Cost is about one credit per character. */
export function createElevenLabsVoice(apiKey = process.env.ELEVENLABS_API_KEY): VoiceProvider {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set.');
  return {
    async synthesize(text, { voiceId, speed }) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { speed } }),
        },
      );
      if (!res.ok) throw new VoiceError(res.status, (await res.text()).slice(0, 300));
      const json = (await res.json()) as TimestampResponse;
      if (!json.alignment) throw new VoiceError(502, 'Response had no character timestamps');
      const words = groupWords(json.alignment);
      const last = json.alignment.character_end_times_seconds.at(-1) ?? 0;
      return {
        audio: Buffer.from(json.audio_base64, 'base64'),
        durationMs: Math.round(last * 1000) + 50,
        words,
        credits: text.length,
      };
    },
  };
}
