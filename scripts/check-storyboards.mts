// Phase 2 gate: 10 topics through the real Gemini storyboard call and the real validator.
// Prints per topic: attempts, scene count, estimated seconds, and any cue problems. Writes out/storyboards/*.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { createGeminiProvider, geminiModel } from '../src/server/ai/gemini';
import { estimateSec, generateStoryboard } from '../src/server/ai/storyboard';
import type { Prompt } from '../src/server/providers';

nextEnv.loadEnvConfig(process.cwd());

const TOPICS: [string, number][] = [
  ['Why do we have seasons?', 60], ['How does photosynthesis work?', 60], ['What is Newton\'s third law?', 30],
  ['The causes of the French Revolution', 90], ['How do vaccines train the immune system?', 60], ['Pythagoras theorem and a proof', 60],
  ['What is inflation?', 30], ['How does the water cycle work?', 60], ['Difference between mitosis and meiosis', 90], ['How do magnets work?', 60],
];

let calls = 0;
const real = createGeminiProvider();
const counting = {
  generate: <T,>(p: Prompt, s: Parameters<typeof real.generate<T>>[1]) => { calls++; return real.generate(p, s); },
};

mkdirSync('out/storyboards', { recursive: true });
console.log(`model: ${geminiModel()}`);
let pass = 0;
for (const [i, [topic, lengthSec]] of TOPICS.entries()) {
  calls = 0;
  const t0 = Date.now();
  try {
    const sb = await generateStoryboard(counting, { topic, lengthSec, audience: 'Class 7', language: 'en' });
    pass++;
    writeFileSync(`out/storyboards/${i + 1}.json`, JSON.stringify(sb, null, 2));
    console.log(`OK   ${topic} (${lengthSec}s): ${sb.scenes.length} scenes, ~${estimateSec(sb.scenes)}s, ${calls} call(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`FAIL ${topic}: ${((e as { details?: { problems?: string[] } }).details?.problems ?? [(e as Error).message]).join(' | ')}`);
  }
}
console.log(`\n${pass}/${TOPICS.length} valid`);
