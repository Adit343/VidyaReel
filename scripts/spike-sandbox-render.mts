// Phase 1 experiments 1 and 2: render the 3-scene fixture in Vercel Sandbox, upload the MP4 to R2.
// Needs Vercel auth in .env.vercel.local (`npx vercel env pull .env.vercel.local`) plus the R2_* vars.
import { existsSync } from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { bundle } from '@remotion/bundler';
import { addBundleToSandbox, createSandbox, renderMediaOnVercel } from '@remotion/vercel';
import { storyboardSchema } from '../src/lib/schemas/storyboard';
import spike from '../src/remotion/fixtures/spike-3-scenes.json';
import { createR2Storage } from '../src/server/storage';

nextEnv.loadEnvConfig(process.cwd());
if (existsSync('.env.vercel.local')) process.loadEnvFile('.env.vercel.local');

const secs = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function main() {
  const t0 = Date.now();
  const bundleDir = await bundle({
    entryPoint: path.resolve('src/remotion/index.ts'),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), '@': path.resolve('src') } },
    }),
  });
  console.log(`bundle built            ${secs(t0)}`);

  const t1 = Date.now();
  const sandbox = await createSandbox({ onProgress: ({ message }) => console.log(`  sandbox: ${message}`) });
  console.log(`sandbox ready           ${secs(t1)}  (id ${sandbox.name ?? 'n/a'})`);
  try {
    const t2 = Date.now();
    await addBundleToSandbox({ sandbox, bundleDir });
    console.log(`bundle uploaded         ${secs(t2)}`);

    const t3 = Date.now();
    let last = -1;
    const { sandboxFilePath, contentType } = await renderMediaOnVercel({
      sandbox,
      compositionId: 'Video',
      inputProps: { scenes: storyboardSchema.shape.scenes.parse(spike.scenes) },
      codec: 'h264',
      onProgress: (p) => {
        const pct = Math.floor(p.overallProgress * 10) * 10;
        if (pct !== last) { last = pct; console.log(`  render ${pct}% (${p.stage})`); }
      },
    });
    console.log(`render finished         ${secs(t3)}  -> ${sandboxFilePath}`);

    const t4 = Date.now();
    const mp4 = await sandbox.readFileToBuffer({ path: sandboxFilePath });
    if (!mp4) throw new Error(`Rendered file missing in sandbox: ${sandboxFilePath}`);
    console.log(`mp4 read from sandbox   ${secs(t4)}  (${(mp4.length / 1024).toFixed(0)} kB)`);

    const t5 = Date.now();
    const storage = createR2Storage();
    const key = 'spike/sandbox-render.mp4';
    await storage.put(key, mp4, contentType || 'video/mp4');
    console.log(`uploaded to R2          ${secs(t5)}`);
    console.log(`signed link (1 h):\n${await storage.signedGet(key, 3600)}`);
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
  console.log(`TOTAL ${secs(t0)}`);
}

main().catch((e) => { console.error('SPIKE FAILED:', e); process.exit(1); });
