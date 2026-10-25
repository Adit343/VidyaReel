// Opens Generate (Step 3) in every state (start, queued, voice, render, cancel confirm, ready, fix panel, failed) in headless
// Chrome against a throwaway in-memory MongoDB, and saves screenshots to the folder in argv[2]. Dev tool, not part of the app.
// The Ready state plays out/spike.mp4, copied to R2 under test/ for the run and deleted afterwards.
//   npx tsx scripts/generate-states-check.mts <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';

nextEnv.loadEnvConfig(process.cwd());
const OUT = process.argv[2] ?? 'out/generate-states';
mkdirSync(OUT, { recursive: true });
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mongo = await MongoMemoryServer.create();
const uri = `${mongo.getUri()}harness`;
const env = { ...process.env, MONGODB_URI: uri, APP_URL: BASE, ADMIN_EMAIL: 'owner@example.com', NEXT_TELEMETRY_DISABLED: '1', INNGEST_DEV: 'http://localhost:9' }; // events go nowhere: the start call must fail cleanly
const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { env, shell: true, stdio: 'pipe' });
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });
const cleanup = async () => {
  server.kill();
  spawn('powershell', ['-NoProfile', '-Command', `Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`]);
  await mongo.stop();
};
for (let i = 0; i < 90 && !log.includes('Ready'); i++) await sleep(1000);
if (!log.includes('Ready')) { console.log(log); await cleanup(); process.exit(1); }

const signup = await fetch(`${BASE}/api/auth/signup`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'owner@example.com', name: 'Owner', password: 'correct horse battery' }),
});
const cookies = signup.headers.getSetCookie().map((c) => c.split(';')[0]);

const mongoClient = await MongoClient.connect(uri);
const db = mongoClient.db('harness');
const owner = await db.collection('users').findOne({ email: 'owner@example.com' });
const fixture = JSON.parse(readFileSync('src/remotion/fixtures/all-templates.json', 'utf8')) as { scenes: Record<string, unknown>[] };
const TEST_KEY = 'test/harness-ready.mp4';
const { createR2Storage } = await import('../src/server/storage/index');
const r2 = createR2Storage();
await r2.put(TEST_KEY, readFileSync('out/spike.mp4'), 'video/mp4');
const scenes = fixture.scenes.slice(0, 6).map((s, order) => ({
  ...s, order, needsCheck: false, durationMs: 9000,
  audio: { key: 'x', hash: 'x', durationMs: 8700, words: [] },
}));
const videoId = new ObjectId();
const base = {
  _id: videoId, userId: owner!._id, title: 'Why seasons happen', status: 'storyboard_ready', topic: 'Classroom micro-lesson explaining axial tilt and solar rays for Class 7.',
  lengthSec: 60, language: 'en', audience: 'General', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', speed: 1, theme: 'forest', musicId: 'healing-piano', musicVolume: 35,
  captionsOn: true, caption: '', hashtags: [], estimatedSec: 58, scenes, version: 1, createdAt: new Date(), updatedAt: new Date(),
};
await db.collection('videos').insertOne(base);
const job = (extra: object) => ({ _id: new ObjectId(), videoId, userId: owner!._id, kind: 'full', attempt: 1, queuedAt: new Date(), ...extra });
const setState = async (video: object, jobDoc?: object) => {
  await db.collection('videos').updateOne({ _id: videoId }, { $unset: { outputKey: '', failureReason: '' } });
  await db.collection('videos').updateOne({ _id: videoId }, { $set: video });
  await db.collection('render_jobs').deleteMany({});
  if (jobDoc) await db.collection('render_jobs').insertOne(jobDoc);
};

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vr-chrome-'))}`,
  '--no-first-run', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank',
]);
let target = '';
for (let i = 0; i < 30 && !target; i++) {
  await sleep(500);
  try {
    const pages = (await (await fetch('http://127.0.0.1:9335/json')).json()) as { type: string; webSocketDebuggerUrl: string }[];
    target = pages.find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? '';
  } catch { /* chrome not up yet */ }
}
const ws = new WebSocket(target);
await new Promise((r) => ws.once('open', r));
let nextId = 1;
const waiting = new Map<number, (v: unknown) => void>();
ws.on('message', (m) => { const d = JSON.parse(String(m)); waiting.get(d.id)?.(d.result ?? d.error); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cdp = (method: string, params: object = {}) => new Promise<any>((res) => { const id = nextId++; waiting.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr: string) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

try {
  await cdp('Page.enable');
  await cdp('Network.enable');
  for (const c of cookies) {
    const [name, ...v] = c.split('=');
    await cdp('Network.setCookie', { name, value: v.join('='), url: BASE });
  }
  const view = (width: number) => cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
  async function shot(name: string, width = 1280) {
    const h = await js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
    const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(h, 2400), scale: 1 } });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  }
  const open = async (wait = 3500) => { await cdp('Page.navigate', { url: `${BASE}/videos/${videoId}/generate` }); await sleep(wait); };
  const click = (text: string) => js(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return 'missing'; b.click(); return 'ok'; })()`);
  await view(1280);

  // Before the first render
  await setState({ status: 'storyboard_ready' });
  await open();
  await shot('0-start');

  // Queued
  await setState({ status: 'rendering' }, job({ status: 'queued', stage: 'load', progress: 0, active: true }));
  await open();
  await shot('1-queued');

  // Voice stage
  await setState({ status: 'rendering' }, job({ status: 'running', stage: 'voice', progress: 14, active: true, startedAt: new Date(Date.now() - 20_000) }));
  await open();
  await shot('2-rendering-voice');

  // Render stage, 62 per cent
  await setState({ status: 'rendering' }, job({ status: 'running', stage: 'render', progress: 62, active: true, startedAt: new Date(Date.now() - 50_000) }));
  await open();
  await shot('3-rendering-62');
  console.log('cancel click:', await click('Cancel render'));
  await sleep(500);
  await shot('4-cancel-confirm');
  console.log('keep going:', await click('Keep going'));
  await sleep(300);
  await view(390);
  await shot('5-rendering-mobile', 390);
  await view(1280);

  // Ready
  await setState({ status: 'ready', outputKey: TEST_KEY, output: { sizeBytes: 553000, validatedAt: new Date(), durationMs: 58_000 } },
    job({ status: 'succeeded', stage: 'finalise', progress: 100, renderSec: 44, startedAt: new Date(Date.now() - 60_000), finishedAt: new Date() }));
  await open(5000);
  await shot('6-ready');
  console.log('video:', JSON.stringify(await js(`(() => { const v = document.querySelector('video'); return v ? { ready: v.readyState, duration: v.duration, err: v.error && v.error.code } : null; })()`)));
  await js(`document.querySelector('button[aria-label="Play video"]').click()`);
  await sleep(2500);
  console.log('playing:', JSON.stringify(await js(`(() => { const v = document.querySelector('video'); return { paused: v.paused, time: v.currentTime }; })()`)));
  await shot('7-ready-playing');
  console.log('fix click:', await click('Fix a scene'));
  await sleep(500);
  await js(`document.querySelector('#fix-scene').scrollIntoView({ block: 'center' })`);
  await shot('8-ready-fix-panel');
  await view(390);
  await open(4500);
  await shot('9-ready-mobile', 390);
  await view(1280);

  // Failed
  await setState({ status: 'failed', failureReason: 'The video could not be assembled. Please try again.' },
    job({ status: 'failed', stage: 'render', progress: 62, error: { code: 'RENDER_FAILED', message: 'The video could not be assembled. Please try again.', step: 'render' }, finishedAt: new Date() }));
  await open();
  await shot('10-failed');

  // API plumbing over HTTP with the signed-in cookie
  const call = async (path: string, init: RequestInit = {}, auth = true) => {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(auth ? { cookie: cookies.join('; ') } : {}) } });
    return { status: res.status, body: await res.json().catch(() => null) as Record<string, any> | null };
  };
  await setState({ status: 'storyboard_ready' });
  const start = await call(`/api/videos/${videoId}/render`, { method: 'POST', body: JSON.stringify({ version: 1 }) });
  console.log('start with no workflow service:', start.status, start.body?.error?.code, '(want 503 PROVIDER_UNAVAILABLE)');
  console.log('video unlocked again:', (await db.collection('videos').findOne({ _id: videoId }))?.status, '(want storyboard_ready)');
  console.log('start without a session:', (await call(`/api/videos/${videoId}/render`, { method: 'POST', body: JSON.stringify({ version: 1 }) }, false)).status, '(want 401)');
  console.log('start with a stale version:', (await call(`/api/videos/${videoId}/render`, { method: 'POST', body: JSON.stringify({ version: 7 }) })).body?.error?.code, '(want VERSION_CONFLICT)');
  console.log('status:', JSON.stringify((await call(`/api/videos/${videoId}/render/status`)).body));
  console.log('media before render:', (await call(`/api/videos/${videoId}/media`)).status, '(want 409)');
  console.log('cancel with nothing running:', (await call(`/api/videos/${videoId}/render/cancel`, { method: 'POST', body: '{}' })).body?.error?.code, '(want INVALID_STATE)');
  await setState({ status: 'ready', outputKey: TEST_KEY });
  const media = await call(`/api/videos/${videoId}/media`);
  console.log('media after render:', media.status, Object.keys(media.body ?? {}).join(','), String(media.body?.downloadUrl).includes('response-content-disposition'));
  const lib = await call('/api/library?status=ready,failed&q=seasons');
  console.log('library:', lib.status, lib.body?.items?.length, lib.body?.items?.[0]?.thumbUrl === null ? 'no poster' : 'poster');
  console.log('library bad status:', (await call('/api/library?status=nope')).status, '(want 400)');
  const dup = await call(`/api/videos/${videoId}/duplicate`, { method: 'POST', body: '{}' });
  console.log('duplicate:', dup.status, dup.body?.title, dup.body?.status);
} finally {
  await r2.delete(TEST_KEY).catch(() => undefined);
  ws.close();
  chrome.kill();
  await mongoClient.close();
  await cleanup();
}
