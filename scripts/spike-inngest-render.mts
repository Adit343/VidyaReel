// Phase 1 experiment 3: drive the Inngest `renderVideo` function and watch MongoDB.
// Usage: tsx scripts/spike-inngest-render.mts [--fail]
// Needs `npm run dev`, `npm run inngest:dev` and `npm run remotion:bundle` running/done first.
import nextEnv from '@next/env';
import { Inngest } from 'inngest';
import { ObjectId } from 'mongodb';
import { storyboardSchema } from '../src/lib/schemas/storyboard';
import spike from '../src/remotion/fixtures/spike-3-scenes.json';
import { getClient } from '../src/server/db/client';
import { users, videos } from '../src/server/db/collections';

nextEnv.loadEnvConfig(process.cwd());
process.env.INNGEST_DEV = '1';

const forceFail = process.argv.includes('--fail');

async function main() {
  const admin = await users().findOne({ email: process.env.ADMIN_EMAIL!.toLowerCase() });
  if (!admin) throw new Error('Sign up the ADMIN_EMAIL account first.');
  const now = new Date();
  const { insertedId } = await videos().insertOne({
    _id: new ObjectId(), userId: admin._id, title: forceFail ? 'Spike (forced failure)' : 'Spike: why is the sky blue',
    status: 'storyboard_ready', scenes: storyboardSchema.shape.scenes.parse(spike.scenes), version: 1, createdAt: now, updatedAt: now,
  });
  const videoId = insertedId.toString();
  await new Inngest({ id: 'vidyareel' }).send({ name: 'video/render.requested', data: { videoId, forceFail } });
  console.log(`event sent, video ${videoId}${forceFail ? ' (forced failure)' : ''}`);

  const t0 = Date.now();
  let last = '';
  for (;;) {
    const v = await videos().findOne({ _id: insertedId });
    const line = `${v?.status}${v?.failureReason ? ` (${v.failureReason})` : ''}`;
    if (line !== last) { last = line; console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${line}`); }
    if (v?.status === 'ready' || v?.status === 'failed') { console.log(JSON.stringify({ outputKey: v.outputKey, output: v.output })); break; }
    if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('Timed out waiting for the workflow');
    await new Promise((r) => setTimeout(r, 2000));
  }
  await getClient().close();
}

main().catch((e) => { console.error('SPIKE FAILED:', e); process.exit(1); });
