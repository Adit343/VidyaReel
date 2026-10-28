// Opens every signed-in screen at 390 px wide (a small phone) in headless Chrome against a throwaway in-memory MongoDB and
// reports pages that scroll sideways, listing the elements that stick out. Saves a screenshot of each page to argv[2].
// Dev tool, not part of the app. Nothing is sent to any service.
//   npx tsx scripts/mobile-check.mts <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';

nextEnv.loadEnvConfig(process.cwd());
const OUT = process.argv[2] ?? 'out/mobile';
mkdirSync(OUT, { recursive: true });
const PORT = 3104;
const BASE = `http://localhost:${PORT}`;
const W = 390;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mongo = await MongoMemoryServer.create();
const uri = `${mongo.getUri()}harness`;
const env = { ...process.env, MONGODB_URI: uri, APP_URL: BASE, ADMIN_EMAIL: 'owner@example.com', NEXT_TELEMETRY_DISABLED: '1', INNGEST_DEV: 'http://localhost:9', INNGEST_BASE_URL: 'http://localhost:9' };
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
  body: JSON.stringify({ email: 'owner@example.com', name: 'Asha Rao', password: 'correct horse battery' }),
});
const cookies = signup.headers.getSetCookie().map((c) => c.split(';')[0]);
const mongoClient = await MongoClient.connect(uri);
const db = mongoClient.db('harness');
const owner = await db.collection('users').findOne({ email: 'owner@example.com' });
const { encryptToken } = await import('../src/server/instagram/crypto');

const templates = ['title-hook', 'bullet-reveal', 'definition-callout', 'step-flow', 'stat', 'comparison'];
const scenes = templates.map((template, order) => ({
  id: `sc_${order}`, order, template, narration: 'Seasons happen because the Earth is tilted as it travels around the Sun, not because of distance.', needsCheck: false,
  durationMs: 9000, elements: [{ type: 'title', text: 'Why seasons happen' }, { type: 'bullet', text: 'The Earth is tilted by about 23.5 degrees' }, { type: 'bullet', text: 'Sunlight lands more directly in summer' }],
}));
const base = { userId: owner!._id, topic: 'Axial tilt', lengthSec: 60, language: 'en', audience: 'General', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', speed: 1, theme: 'forest', musicId: null, musicVolume: 35, captionsOn: true, scenes, version: 1, createdAt: new Date(), updatedAt: new Date() };
const ids: Record<string, ObjectId> = {};
for (const status of ['draft', 'storyboard_ready', 'rendering', 'ready', 'posted', 'failed', 'scheduled']) {
  ids[status] = new ObjectId();
  await db.collection('videos').insertOne({ ...base, _id: ids[status], title: `A fairly long lesson title about why seasons happen (${status})`, status, caption: 'Why do we have seasons? #science', hashtags: ['#science'], outputKey: 'x/y.mp4', output: { sizeBytes: 5e5, validatedAt: new Date(), durationMs: 58000 } });
}
const connId = new ObjectId();
await db.collection('instagram_connections').insertOne({ _id: connId, userId: owner!._id, igUserId: '1', username: 'asha.explains', accountType: 'CREATOR', ...encryptToken('T'), tokenExpiresAt: new Date(Date.now() + 5e9), scopes: [], status: 'connected', connectedAt: new Date() });
await db.collection('posts').insertMany([
  { videoId: ids.scheduled, status: 'scheduled', mode: 'scheduled', scheduledAt: new Date(Date.now() + 86400e3), live: true },
  { videoId: ids.posted, status: 'posted', mode: 'now', permalink: 'https://instagram.com/p/x' },
  { videoId: ids.failed, status: 'failed', mode: 'now', error: { code: 'X', message: 'Instagram refused the video because it is too long for a Reel.' } },
].map((p) => ({ _id: new ObjectId(), userId: owner!._id, connectionId: connId, caption: 'Hello', retryCount: 0, rev: 1, createdAt: new Date(), updatedAt: new Date(), ...p })));
await db.collection('notifications').insertMany(['A long video title is ready', 'Another one failed'].map((title, i) => ({ _id: new ObjectId(), userId: owner!._id, kind: i ? 'render_failed' : 'render_ready', refId: new ObjectId(), title, body: 'Body text that is long enough to need wrapping on a phone screen.', href: '/', retry: false, createdAt: new Date() })));

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9337', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vr-chrome-'))}`, '--no-first-run', '--hide-scrollbars', 'about:blank',
]);
let target = '';
for (let i = 0; i < 30 && !target; i++) {
  await sleep(500);
  try {
    const pages = (await (await fetch('http://127.0.0.1:9337/json')).json()) as { type: string; webSocketDebuggerUrl: string }[];
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

const pages: [string, string][] = [
  ['home', '/'], ['library', '/library'], ['posts', '/posts'], ['settings', '/settings'], ['admin', '/admin'], ['create', '/create'],
  ['review', `/videos/${ids.storyboard_ready}/review`], ['generate-ready', `/videos/${ids.ready}/generate`], ['generate-rendering', `/videos/${ids.rendering}/generate`],
  ['generate-failed', `/videos/${ids.failed}/generate`], ['post-ready', `/videos/${ids.ready}/post`], ['post-scheduled', `/videos/${ids.scheduled}/post`], ['post-posted', `/videos/${ids.posted}/post`],
];
const probe = `(() => {
  const w = document.documentElement.clientWidth, over = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; }
      if (!clipped) over.push((el.tagName + '.' + String(el.className).split(' ').slice(0, 3).join('.')).slice(0, 70) + ' right=' + Math.round(r.right));
    }
  }
  return JSON.stringify({ scrollW: document.documentElement.scrollWidth, w, url: location.pathname, over: over.slice(0, 6) });
})()`;
let bad = 0;
try {
  await cdp('Page.enable');
  await cdp('Network.enable');
  for (const c of cookies) { const [name, ...v] = c.split('='); await cdp('Network.setCookie', { name, value: v.join('='), url: BASE }); }
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const [name, path] of pages) {
    await cdp('Page.navigate', { url: `${BASE}${path}` });
    await sleep(name === 'review' ? 6000 : 3500);
    const r = JSON.parse(await js(probe));
    const flag = r.scrollW > r.w ? 'SIDEWAYS SCROLL' : r.over.length ? 'sticks out' : 'ok';
    if (flag !== 'ok') bad++;
    console.log(name.padEnd(20), r.url.slice(0, 20).padEnd(22), flag, r.scrollW > r.w ? `(${r.scrollW} > ${r.w})` : '', r.over.length ? '\n    ' + r.over.join('\n    ') : '');
    const h = await js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: Math.min(h, 3000), scale: 1 } });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
  }
  console.log(bad ? `\n${bad} page(s) need work` : '\nAll pages fit 390 px');
} finally {
  chrome.kill();
  ws.close();
  await mongoClient.close();
  await cleanup();
}
