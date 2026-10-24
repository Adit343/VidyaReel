import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createR2Storage } from '../src/server/storage';

(async () => {
  const s = createR2Storage();
  const key = 'smoke/hello.txt';
  await s.put(key, Buffer.from('Vidyareel R2 smoke test'), 'text/plain');
  const url = await s.signedGet(key, 300);
  const res = await fetch(url);
  console.log('signed GET', res.status, JSON.stringify(await res.text()));
  const bare = await fetch(url.split('?')[0]);
  console.log('unsigned GET (must be refused)', bare.status);
  await s.delete(key);
  console.log('after delete', (await fetch(await s.signedGet(key, 60))).status);
})().catch((e) => { console.error('R2 FAILED:', e.name, e.message); process.exit(1); });
