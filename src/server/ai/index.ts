import type { LlmProvider } from '@/server/providers';
import { createGeminiProvider } from './gemini';

let override: LlmProvider | undefined;

/** The LLM used by the app. Tests swap it with `setLlm`. */
export const getLlm = (): LlmProvider => override ?? createGeminiProvider();
export const setLlm = (llm: LlmProvider | undefined) => { override = llm; };
