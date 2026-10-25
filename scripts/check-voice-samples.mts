// Records each voice's sample (first run only: later runs reuse R2), then fetches the signed link and saves it to out/voice.
import { mkdir, writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const { VOICES } = await import('../src/config/voices');
const { sampleUrl } = await import('../src/server/voice/samples');
const { storage } = await import('../src/server/storage');
const { createElevenLabsVoice } = await import('../src/server/voice');

await mkdir('out/voice', { recursive: true });
for (const v of VOICES) {
  const url = await sampleUrl({ storage: storage(), voice: () => createElevenLabsVoice() }, v.id);
  const res = await fetch(url!);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(`out/voice/sample-${v.name.toLowerCase()}.mp3`, bytes);
  console.log(`${v.name}: ${res.status} ${res.headers.get('content-type')} ${bytes.length} bytes`);
}
