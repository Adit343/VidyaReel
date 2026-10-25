// Phase 4 gate: runs the real render workflow end to end (ElevenLabs voice, sync, Pixabay clip, Vercel Sandbox, R2) for a
// small 4-scene video owned by ADMIN_EMAIL, polling the render job like the Generate screen does.
//   npx tsx scripts/check-render.mts [--fail] [--fix]
// Needs `npm run dev -- -p 3105` (started with INNGEST_DEV=1), `npx inngest-cli dev -u http://localhost:3105/api/inngest`,
// a fresh VERCEL_OIDC_TOKEN (`npx vercel env pull .env.vercel.local`) and `npm run remotion:bundle` first.
//   --fail  forces the render step to fail: the video must end `failed` and the day's cap is refunded.
//   --fix   after the first render, edits one scene and runs a fix-a-scene render: only that scene is re-voiced.
import { writeFileSync, mkdirSync } from 'node:fs';
import nextEnv from '@next/env';
import { ObjectId } from 'mongodb';

nextEnv.loadEnvConfig(process.cwd());
process.env.INNGEST_DEV = '1';

const { VOICES } = await import('../src/config/voices');
const { storyboardSchema } = await import('../src/lib/schemas/storyboard');
const { default: spike } = await import('../src/remotion/fixtures/spike-3-scenes.json', { with: { type: 'json' } });
const { default: all } = await import('../src/remotion/fixtures/all-templates.json', { with: { type: 'json' } });
const { getClient } = await import('../src/server/db/client');
const { renderJobs, usageLog, users, videos } = await import('../src/server/db/collections');
const { startRender } = await import('../src/server/render/jobs');
const { getQuota } = await import('../src/server/quota');
const { storage } = await import('../src/server/storage');
const { inngest } = await import('../src/workflows/inngest');

const forceFail = process.argv.includes('--fail');
const doFix = process.argv.includes('--fix');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const admin = await users().findOne({ email: process.env.ADMIN_EMAIL!.toLowerCase() });
if (!admin) throw new Error('Sign up the ADMIN_EMAIL account first.');
const owner = { id: admin._id, email: admin.email, timeZone: admin.timeZone };

const clip = (all.scenes as Record<string, unknown>[]).find((s) => s.template === 'stock-clip')!;
const strip = (s: Record<string, unknown>, id: string) => { const { durationMs: _d, audio: _a, ...rest } = s; void _d; void _a; return { ...rest, id }; };
const scenes = storyboardSchema.shape.scenes.parse([...spike.scenes, clip].map((s, n) => ({ ...strip(s as Record<string, unknown>, `sc_check${n + 1}`), order: n })));

const now = new Date();
const video = {
  _id: new ObjectId(), userId: admin._id, title: forceFail ? 'Render check (forced failure)' : 'Render check: why is the sky blue', status: 'storyboard_ready' as const,
  topic: 'Phase 4 end-to-end check', lengthSec: 30 as const, language: 'en', audience: 'General', voiceId: VOICES[0].id,
  speed: 1, theme: 'forest', accent: '#145A41', musicId: 'healing-piano', musicVolume: 35, captionsOn: true, caption: '', hashtags: [], estimatedSec: 25,
  scenes, version: 1, createdAt: now, updatedAt: now,
};
await videos().insertOne(video);
const id = String(video._id);
console.log(`video ${id} created; quota before:`, JSON.stringify(await getQuota(admin._id, admin.email, admin.timeZone)));

async function run(label: string, sceneIds?: string[], fail = false) {
  const v = await videos().findOne({ _id: video._id });
  const t0 = Date.now();
  const { job } = await startRender(owner, id, { version: v!.version, sceneIds }, {
    storage: storage(), send: (name, data) => inngest.send({ name, data: { ...data, forceFail: fail } }),
  });
  console.log(`[${label}] job ${job.id} ${job.kind} queued`);
  let last = '';
  for (;;) {
    const j = await renderJobs().findOne({ _id: new ObjectId(job.id) });
    const line = `${j?.status} ${j?.stage} ${j?.progress}%`;
    if (line !== last) { last = line; console.log(`[${label} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${line}`); }
    if (j && j.status !== 'queued' && j.status !== 'running') return { job: j, seconds: (Date.now() - t0) / 1000 };
    if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('Timed out waiting for the render');
    await sleep(2000);
  }
}

async function report(label: string, r: Awaited<ReturnType<typeof run>>) {
  const v = (await videos().findOne({ _id: video._id }))!;
  console.log(`[${label}] job ${r.job.status} in ${r.seconds.toFixed(0)}s; video ${v.status}; voice credits ${r.job.voiceCredits ?? 'n/a'}; warnings ${JSON.stringify(r.job.warnings ?? [])}`);
  if (r.job.error) console.log('  error:', JSON.stringify(r.job.error));
  console.log('  scenes:', v.scenes.map((s) => `${s.id}:${s.template}:${s.durationMs ?? '-'}ms:${s.audio ? 'audio' : 'no-audio'}`).join(' '));
  if (v.outputKey) {
    const res = await fetch(await storage().signedGet(v.outputKey, 300));
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync('out', { recursive: true });
    writeFileSync(`out/check-render-${label}.mp4`, buf);
    console.log(`  output ${v.outputKey}: ${res.status} ${res.headers.get('content-type')} ${buf.length} bytes -> out/check-render-${label}.mp4; poster ${v.thumbKey ?? 'none'}`);
  }
  return v;
}

try {
  const first = await run('render', undefined, forceFail);
  const v1 = await report('render', first);
  console.log('quota after:', JSON.stringify(await getQuota(admin._id, admin.email, admin.timeZone)));
  if (forceFail) console.log(v1.status === 'failed' ? 'PASS: forced failure ended failed and was refunded' : 'FAIL: video is not failed');
  else if (doFix && v1.status === 'ready') {
    const creditsBefore = (await usageLog().find({ videoId: video._id }).toArray()).length;
    const target = v1.scenes[1];
    await videos().updateOne({ _id: video._id, 'scenes.id': target.id }, { $set: { 'scenes.$.narration': `${target.narration} It happens every autumn.` }, $unset: { 'scenes.$.audio': '' }, $inc: { version: 1 } });
    const fix = await run('fix', [target.id]);
    await report('fix', fix);
    console.log(`voice calls: first render ${creditsBefore}, after fix ${(await usageLog().find({ videoId: video._id }).toArray()).length} (expect +1)`);
  }
} finally {
  await getClient().close();
}
