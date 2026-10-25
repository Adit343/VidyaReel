// Searches Pixabay for a portrait clip, downloads it to out/media and prints the licence record.
// Usage: npm run check:media -- "photosynthesis leaf"
import { mkdir, writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const { createPixabayMedia } = await import('../src/server/media/pixabay');

const key = process.env.PIXABAY_API_KEY;
if (!key) throw new Error('Set PIXABAY_API_KEY in .env.local');
const query = process.argv[2] ?? 'sunlight clouds';
const found = await createPixabayMedia(key).search(query, { orientation: 'portrait', minSec: 4 });
console.log(`${found.length} clips for "${query}"`);
for (const c of found.slice(0, 5)) console.log(`${c.height > c.width ? 'portrait ' : 'landscape'} ${c.width}x${c.height} ${c.durationSec}s ${c.pageUrl}`);
const best = found[0];
if (!best) process.exit(1);
const res = await fetch(best.url);
await mkdir('out/media', { recursive: true });
const file = `out/media/pixabay-${best.id}.mp4`;
await writeFile(file, Buffer.from(await res.arrayBuffer()));
console.log(`saved ${file}\nlicence: ${best.licence}`);
