// Drives Create and Review in headless Chrome against a throwaway in-memory MongoDB and the real Gemini key,
// and saves a screenshot of every Stitch state to the folder given as argv[2]. Dev tool, not part of the app.
//   npx tsx scripts/ui-harness.mts <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';

nextEnv.loadEnvConfig(process.cwd());
const OUT = process.argv[2] ?? 'out/ui';
mkdirSync(OUT, { recursive: true });
const PORT = 3100;
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
  // next dev runs under a shell: kill its whole tree and whatever still listens on the port
  spawn('powershell', ['-NoProfile', '-Command', `Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`]);
  await mongo.stop();
};
process.on('exit', () => server.kill());

for (let i = 0; i < 90 && !log.includes('Ready'); i++) await sleep(1000);
if (!log.includes('Ready')) { console.log(log); await cleanup(); process.exit(1); }

const post = (path: string, body: unknown, cookie = '') =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });

const signup = await post('/api/auth/signup', { email: 'owner@example.com', name: 'Aditi Deshmukh', password: 'correct horse battery' });
const cookies = signup.headers.getSetCookie().map((c) => c.split(';')[0]);
const cookieHeader = cookies.join('; ');
console.log('signup', signup.status);

// ---- Chrome over CDP ----
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vr-chrome-'))}`,
  '--no-first-run', '--hide-scrollbars', 'about:blank',
]);
let target = '';
for (let i = 0; i < 30 && !target; i++) {
  await sleep(500);
  try {
    const pages = (await (await fetch('http://127.0.0.1:9333/json')).json()) as { type: string; webSocketDebuggerUrl: string }[];
    target = pages.find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? '';
  } catch { /* chrome not up yet */ }
}
const ws = new WebSocket(target);
await new Promise((r) => ws.once('open', r));
let nextId = 1;
const waiting = new Map<number, (v: unknown) => void>();
ws.on('message', (m) => { const d = JSON.parse(String(m)); waiting.get(d.id)?.(d.result ?? d.error); });
const cdp = (method: string, params: object = {}) => new Promise<any>((res) => { const id = nextId++; waiting.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr: string) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

async function view(width: number, height = 900, mobile = false) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
}
async function go(path: string) { await cdp('Page.navigate', { url: BASE + path }); await sleep(2500); }
async function shot(name: string, full = true) {
  let clip: object | undefined;
  if (full) {
    const h = await js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
    const w = await js('window.innerWidth');
    clip = { x: 0, y: 0, width: w, height: Math.min(h, 3200), scale: 1 };
  }
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}
const click = (sel: string) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'missing ${sel}'; e.click(); return 'ok'; })()`);
const clickText = (text: string, tag = 'button') => js(`(() => { const e = [...document.querySelectorAll('${tag}')].find((x) => x.textContent.replace(/^[a-z_]+(?=[A-Z])/, '').trim().includes(${JSON.stringify(text)})); if (!e) return 'missing ${text}'; e.click(); return 'ok'; })()`);
const setValue = (sel: string, v: string) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const p = Object.getPrototypeOf(e); Object.getOwnPropertyDescriptor(p, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
const fakeFetch = (urlPart: string, status: number, body: unknown) => js(`(() => { const orig = window.__origFetch || window.fetch; window.__origFetch = orig; window.fetch = (u, i) => String(u).includes(${JSON.stringify(urlPart)}) ? Promise.resolve(new Response(${JSON.stringify(JSON.stringify(body))}, { status: ${status}, headers: { 'content-type': 'application/json' } })) : orig(u, i); return 'ok'; })()`);
const unfake = () => js('(() => { if (window.__origFetch) window.fetch = window.__origFetch; return "ok"; })()');

await cdp('Page.enable');
await cdp('Network.enable');
for (const c of cookies) {
  const [name, ...v] = c.split('=');
  await cdp('Network.setCookie', { name, value: v.join('='), url: BASE });
}

const mongoClient = await MongoClient.connect(uri);
const db = mongoClient.db('harness');
const owner = await db.collection('users').findOne({ email: 'owner@example.com' });

try {
  // ===== Create: desktop =====
  await view(1280);
  await go('/create');
  await shot('create-1-default');
  await clickText('Seasons');
  await sleep(300);
  await shot('create-2-typed');
  await js(`(() => { document.querySelector('#topic-input').blur(); return 1; })()`);

  await fakeFetch('/api/videos', 422, { error: { code: 'UNSAFE_TOPIC', message: 'x' } });
  await clickText('Create script and storyboard');
  await sleep(500);
  await shot('create-3-unsafe');
  await fakeFetch('/api/videos', 429, { error: { code: 'DAILY_LIMIT', message: 'x' } });
  await clickText('Dismiss');
  await clickText('Create script and storyboard');
  await sleep(500);
  await shot('create-4-daily');
  await js('location.reload()'); await sleep(2500);
  await fakeFetch('/api/videos', 422, { error: { code: 'STORYBOARD_FAILED', message: 'x', details: { videoId: 'abc', version: 3 } } });
  await clickText('Seasons');
  await clickText('Create script and storyboard');
  await sleep(500);
  await shot('create-5-failed');

  // ===== Create: loading (real call), lands on Review =====
  await go('/create?topic=Why%20do%20we%20have%20seasons%3F');
  await clickText('Create script and storyboard');
  await sleep(1200);
  await shot('create-6-loading');
  for (let i = 0; i < 180 && !(await js('location.pathname')).includes('/review'); i++) await sleep(1000);
  console.log('landed on', await js('location.pathname'));
  await sleep(2500);
  const reviewPath = await js('location.pathname');

  // ===== Review =====
  await shot('review-1-default');
  await clickText('Seasons', 'h1');
  await js(`(() => { const b = document.querySelector('[aria-label="Scene actions"]'); b.click(); return 1; })()`);
  await sleep(300);
  await shot('review-2-menu', false);
  await clickText('Edit text', '[role=menuitem]');
  await sleep(500);
  await shot('review-3-editing', false);
  // long narration -> duration alert
  await setValue('textarea[id^="narr-"]', 'Seasons are caused by the tilt of the Earth. '.repeat(13));
  await clickText('Save changes');
  await sleep(2500);
  await shot('review-4-warning');
  await js(`window.scrollTo(0, 0)`);
  // delete confirmation
  await js(`(() => { const bs = document.querySelectorAll('[aria-label="Scene actions"]'); bs[bs.length - 1].click(); return 1; })()`);
  await sleep(200);
  await clickText('Delete scene', '[role=menuitem]');
  await sleep(300);
  await shot('review-5-delete-confirm', false);
  await clickText('Cancel');
  await js('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))');
  // saving + conflict
  await fakeFetch(`/api/videos/${reviewPath.split('/')[2]}`, 409, { error: { code: 'VERSION_CONFLICT', message: 'x' } });
  await click('input[aria-label="Word-by-word captions"]');
  await sleep(1800);
  await js('window.scrollTo(0, 0)');
  await shot('review-6-conflict', false);
  await unfake();
  // regenerating (real call) - screenshot while it runs
  await js(`(() => { const bs = document.querySelectorAll('[aria-label="Scene actions"]'); bs[1].click(); return 1; })()`);
  await clickText('Regenerate scene', '[role=menuitem]');
  await sleep(700);
  await shot('review-7-regenerating', false);
  await sleep(9000);
  // whole-script confirm + skeleton
  await js('location.reload()'); await sleep(3000);
  await clickText('Regenerate whole script');
  await sleep(400);
  await shot('review-8-regenerate-confirm', false);
  await clickText('Yes, regenerate');
  await sleep(700);
  await shot('review-9-skeleton', false);
  await sleep(14000);

  // empty + failed (rows made directly)
  const empty = await db.collection('videos').insertOne({
    userId: owner!._id, title: 'Empty draft', status: 'draft', topic: 'x', lengthSec: 60, scenes: [], version: 1, voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    createdAt: new Date(), updatedAt: new Date(),
  } as never);
  await go(`/videos/${empty.insertedId}/review`);
  await shot('review-10-empty');
  await db.collection('videos').updateOne({ _id: empty.insertedId }, { $set: { status: 'failed' } });
  await go(`/videos/${empty.insertedId}/review`);
  await shot('review-11-failed');

  // ===== mobile =====
  await view(390, 844, true);
  await go('/create');
  await shot('create-7-mobile');
  await go(reviewPath);
  await shot('review-12-mobile');
  // 404
  await go(`/videos/${new ObjectId()}/review`);
  await shot('review-13-not-found', false);
} catch (e) {
  console.log('HARNESS ERROR', e);
} finally {
  await mongoClient.close();
  ws.close();
  chrome.kill();
  await cleanup();
  console.log('server log tail:\n', log.split('\n').slice(-15).join('\n'));
  process.exit(0);
}
