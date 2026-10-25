// Opens Review for a video holding one scene per template (no Gemini call) in headless Chrome against a throwaway
// in-memory MongoDB, and saves screenshots to the folder in argv[2]. Dev tool, not part of the app.
//   npx tsx scripts/review-preview-check.mts <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';

nextEnv.loadEnvConfig(process.cwd());
const OUT = process.argv[2] ?? 'out/review-preview';
mkdirSync(OUT, { recursive: true });
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mongo = await MongoMemoryServer.create();
const uri = `${mongo.getUri()}harness`;
const env = { ...process.env, MONGODB_URI: uri, APP_URL: BASE, ADMIN_EMAIL: 'owner@example.com', NEXT_TELEMETRY_DISABLED: '1' };
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
const videoId = new ObjectId();
await db.collection('videos').insertOne({
  _id: videoId, userId: owner!._id, title: 'Template preview check', status: 'storyboard_ready', topic: 'Why do seasons change?', lengthSec: 90,
  language: 'en', audience: 'General', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', speed: 1, theme: 'forest', musicId: null, musicVolume: 35, captionsOn: true,
  caption: '', hashtags: [], scenes: fixture.scenes.map((s, order) => ({ ...s, order, needsCheck: false })), version: 1,
  createdAt: new Date(), updatedAt: new Date(),
});

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vr-chrome-'))}`,
  '--no-first-run', '--hide-scrollbars', 'about:blank',
]);
let target = '';
for (let i = 0; i < 30 && !target; i++) {
  await sleep(500);
  try {
    const pages = (await (await fetch('http://127.0.0.1:9334/json')).json()) as { type: string; webSocketDebuggerUrl: string }[];
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
async function shot(name: string, height: number) {
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1280, height, scale: 1 } });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}

try {
  await cdp('Page.enable');
  await cdp('Network.enable');
  for (const c of cookies) {
    const [name, ...v] = c.split('=');
    await cdp('Network.setCookie', { name, value: v.join('='), url: BASE });
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `${BASE}/videos/${videoId}/review` });
  for (let i = 0; i < 60 && !(await js(`document.querySelectorAll('#scenes-container article').length`)); i++) await sleep(1000);
  await sleep(6000); // fonts and players
  console.log('scene cards:', await js(`document.querySelectorAll('#scenes-container article').length`));
  console.log('player canvases:', await js(`document.querySelectorAll('#scenes-container [class*="remotion"], #scenes-container [data-remotion-canvas]').length`));
  const h = await js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
  await shot('review-forest-top', 1500);
  await shot('review-forest-bottom', Math.min(h, 4200));
  // Saffron, then Sage Dark, through the real settings buttons
  for (const [label, name] of [['Saffron', 'review-saffron'], ['Sage Dark', 'review-sage']] as const) {
    await js(`(() => { const b = [...document.querySelectorAll('button[role=radio]')].find((x) => x.textContent.includes(${JSON.stringify(label)})); b.click(); return 1; })()`);
    await sleep(1500);
    await shot(name, 1500);
  }
} finally {
  ws.close();
  chrome.kill();
  await mongoClient.close();
  await cleanup();
}
