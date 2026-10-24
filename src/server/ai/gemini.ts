import type { ZodType, ZodTypeDef } from 'zod';
import type { LlmProvider, Prompt } from '@/server/providers';

/** The model, overridable. The 2.x models are closed to new keys; a flash-lite model fits the free tier. */
export const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

export class LlmError extends Error {
  constructor(public kind: 'unavailable' | 'invalid', message: string) { super(message); }
}

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; error?: { message?: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Text of the answer, without the model's "thought" parts, and without a stray code fence. */
export function answerText(res: GeminiResponse) {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('').trim();
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

/**
 * Gemini over REST: JSON mode, then the zod schema. One retry after a provider 429 (System-Design 7.1).
 * A body that is not valid JSON or does not match the schema throws `invalid` so the caller can retry with the error text.
 */
export function createGeminiProvider(fetchImpl: typeof fetch = fetch, retryDelayMs = 2000): LlmProvider {
  return {
    async generate<T>(prompt: Prompt, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new LlmError('unavailable', 'GEMINI_API_KEY is not set');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`;
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      });

      let res: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetchImpl(url, {
            method: 'POST', body, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            signal: AbortSignal.timeout(50_000),
          });
        } catch {
          throw new LlmError('unavailable', 'Gemini did not answer in time');
        }
        if (res.status !== 429 || attempt === 1) break;
        await sleep(retryDelayMs);
      }
      if (!res || !res.ok) {
        const detail = ((await res?.json().catch(() => null)) as GeminiResponse | null)?.error?.message;
        throw new LlmError('unavailable', `Gemini ${res?.status ?? '?'}${detail ? `: ${detail}` : ''}`);
      }

      const text = answerText((await res.json()) as GeminiResponse);
      let json: unknown;
      try { json = JSON.parse(text); } catch { throw new LlmError('invalid', 'The answer was not valid JSON'); }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        const why = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
        throw new LlmError('invalid', `The answer did not match the format (${why})`);
      }
      return parsed.data;
    },
  };
}
