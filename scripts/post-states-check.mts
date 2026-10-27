// Opens Post (Step 4) in every state of the Stitch design (Connected form, Not connected, Publishing, Posted, Scheduled,
// Failed, Already posted) and Settings (Instagram card in its four states, delete panel) in headless Chrome against a
// throwaway in-memory MongoDB, saves screenshots to the folder in argv[2], and checks the Instagram and posts API over
// HTTP. Dev tool, not part of the app. Nothing is sent to Instagram: the workflow service is pointed nowhere.
// The video uses out/spike.mp4, copied to R2 under test/ for the run and deleted afterwards.
//   npx tsx scripts/post-states-check.mts <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';

nextEnv.loadEnvConfig(process.cwd());
const OUT = process.argv[2] ?? 'out/post-states';
mkdirSync(OUT, { recursive: true });
const PORT = 3103;
const BASE = `http://localhost:${PORT}`;
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
const TEST_KEY = 'test/harness-post.mp4';
const { createR2Storage } = await import('../src/server/storage/index');
const r2 = createR2Storage();
await r2.put(TEST_KEY, readFileSync('out/spike.mp4'), 'video/mp4');

const videoId = new ObjectId();
await db.collection('videos').insertOne({
  _id: videoId, userId: owner!._id, title: 'Why seasons happen', status: 'ready', topic: 'Axial tilt and solar rays for Class 7.',
  lengthSec: 60, language: 'en', audience: 'General', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', speed: 1, theme: 'forest', musicId: null, musicVolume: 35,
  captionsOn: true, caption: 'Why do we actually have seasons? It is not our distance from the sun. It is the tilt of the Earth. What did you think? 🌍',
  hashtags: ['#science', '#seasons', '#class7'], estimatedSec: 58,
  scenes: Array.from({ length: 6 }, (_, order) => ({ id: `sc_${order}`, order, template: 'bullet-reveal', narration: 'x', needsCheck: false, elements: [] })),
  outputKey: TEST_KEY, output: { sizeBytes: 553000, validatedAt: new Date(), durationMs: 58_000 }, version: 1, createdAt: new Date(), updatedAt: new Date(),
});
const connId = new ObjectId();
const connection = (status = 'connected', accountType = 'CREATOR') => ({
  _id: connId, userId: owner!._id, igUserId: '17841', username: 'asha.explains', accountType, ...encryptToken('SECRET-TOKEN-VALUE'),
  tokenExpiresAt: new Date(Date.now() + 50 * 24 * 3600e3), scopes: [], status, connectedAt: new Date(Date.now() - 9 * 24 * 3600e3),
});
const setConnection = async (c: object | null) => {
  await db.collection('instagram_connections').deleteMany({});
  if (c) await db.collection('instagram_connections').insertOne(c);
};
const postDoc = (extra: object) => ({
  _id: new ObjectId(), videoId, userId: owner!._id, connectionId: connId, caption: 'Hello', mode: 'now', status: 'publishing', retryCount: 0, rev: 1,
  createdAt: new Date(), updatedAt: new Date(), ...extra,
});
const setState = async (video: object, ...posts: object[]) => {
  await db.collection('videos').updateOne({ _id: videoId }, { $set: { status: 'ready', ...video } });
  await db.collection('posts').deleteMany({});
  if (posts.length) await db.collection('posts').insertMany(posts as never[]);
};

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vr-chrome-'))}`,
  '--no-first-run', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank',
]);
let target = '';
for (let i = 0; i < 30 && !target; i++) {
  await sleep(500);
  try {
    const pages = (await (await fetch('http://127.0.0.1:9336/json')).json()) as { type: string; webSocketDebuggerUrl: string }[];
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
  const open = async (path = `/videos/${videoId}/post`, wait = 3500) => { await cdp('Page.navigate', { url: `${BASE}${path}` }); await sleep(wait); };
  const click = (text: string) => js(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return 'missing'; b.click(); return 'ok'; })()`);
  const text = () => js('document.body.innerText');
  await view(1280);

  // 1 Connected (default), then the schedule tab
  await setConnection(connection());
  await setState({});
  await open();
  await shot('1-connected');
  console.log('schedule tab:', await click('Schedule for later'));
  await sleep(400);
  await shot('1b-connected-schedule');
  await view(390);
  await shot('1c-connected-mobile', 390);
  await view(1280);

  // 2 Not connected, and the way back from Meta
  await setConnection(null);
  await open();
  await shot('2-not-connected');
  await open(`/videos/${videoId}/post?ig=not_eligible`);
  await shot('2b-not-eligible');
  await setConnection(connection('needs_reconnect'));
  await open();
  await shot('2c-needs-reconnect');
  await setConnection(connection());

  // 3 Publishing
  await setState({ status: 'scheduled' }, postDoc({ status: 'publishing', live: true, containerId: 'C1' }));
  await open();
  await shot('3-publishing');

  // 4 Posted
  await setState({ status: 'posted' }, postDoc({ status: 'posted', permalink: 'https://www.instagram.com/reel/De4psPxj0VT/', igMediaId: 'M1' }));
  await open();
  await shot('4-posted');

  // 7 Already posted: "Post it again" shows the warning, "Post again anyway" opens the form
  console.log('post again:', await click('Post it again'));
  await sleep(400);
  await shot('7-already-posted');
  console.log('anyway:', await click('Post again anyway'));
  await sleep(400);
  console.log('form after warning:', (await text()).includes('Ready to publish'));

  // 5 Scheduled, edit schedule, cancel confirm, paused
  const at = new Date(Date.now() + 18 * 3600e3 + 24 * 60e3);
  await setState({ status: 'scheduled' }, postDoc({ mode: 'scheduled', scheduledAt: at, status: 'scheduled', live: true }));
  await open();
  await shot('5-scheduled');
  console.log('edit:', await click('Edit schedule'));
  await sleep(400);
  await shot('5b-scheduled-edit');
  await open();
  console.log('cancel:', await click('Cancel schedule'));
  await sleep(400);
  await shot('5c-scheduled-cancel-confirm');
  await setState({ status: 'scheduled' }, postDoc({ mode: 'scheduled', scheduledAt: at, status: 'scheduled', live: true, paused: true }));
  await open();
  await shot('5d-scheduled-paused');

  // 6 Failed (Instagram refused it) and failed (needs reconnect)
  await setState({}, postDoc({ status: 'failed', error: { code: 'IG_REJECTED', message: 'Instagram does not support this video format.' } }));
  await open();
  await shot('6-failed');
  await setState({}, postDoc({ status: 'failed', error: { code: 'IG_NEEDS_RECONNECT', message: 'Your Instagram connection expired. Reconnect your account, then try again. Your video is safe.' } }));
  await open();
  await shot('6b-failed-reconnect');

  // Settings
  await setConnection(connection());
  await setState({}, postDoc({ mode: 'scheduled', scheduledAt: at, status: 'scheduled', live: true }));
  await open('/settings');
  await shot('s1-settings-connected');
  console.log('disconnect:', await click('Disconnect'));
  await sleep(400);
  await shot('s2-settings-disconnect-confirm');
  await setConnection(connection('needs_reconnect'));
  await open('/settings');
  await shot('s3-settings-reconnect');
  await setConnection(null);
  await open('/settings?ig=cancelled');
  await shot('s4-settings-unconnected');
  console.log('delete open:', await click('Delete my data'));
  await sleep(400);
  await shot('s5-settings-delete-confirm');
  await view(390);
  await open('/settings');
  await shot('s6-settings-mobile', 390);
  await view(1280);

  // Posts screen: one of each kind
  await setConnection(connection());
  await setState({ status: 'posted' },
    postDoc({ status: 'posted', permalink: 'https://www.instagram.com/reel/De4psPxj0VT/', createdAt: new Date(Date.now() - 3600e3) }),
    postDoc({ mode: 'scheduled', scheduledAt: at, status: 'scheduled', live: true, createdAt: new Date() }),
    postDoc({ status: 'failed', error: { code: 'IG_REJECTED', message: 'Instagram does not support this video format.' }, createdAt: new Date(Date.now() - 7200e3) }),
    postDoc({ status: 'cancelled', createdAt: new Date(Date.now() - 9000e3) }));
  await open('/posts');
  await shot('p1-posts');
  await open('/posts?show=published');
  await shot('p2-posts-published');
  await setState({}); await open('/posts');
  await shot('p3-posts-empty');
  await view(390); await setState({ status: 'posted' }, postDoc({ status: 'posted', permalink: 'https://www.instagram.com/reel/x/' })); await open('/posts');
  await shot('p4-posts-mobile', 390);
  await view(1280);

  // API plumbing over HTTP with the signed-in cookie
  const call = async (path: string, init: RequestInit = {}, auth = true) => {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init, headers: { 'content-type': 'application/json', ...(auth ? { cookie: cookies.join('; ') } : {}) } });
    return { status: res.status, location: res.headers.get('location'), body: await res.json().catch(() => null) as Record<string, any> | null };
  };
  await setConnection(connection());
  await setState({});
  const post = (b: object, auth = true) => call(`/api/videos/${videoId}/post`, { method: 'POST', body: JSON.stringify(b) }, auth);
  const r1 = await post({ caption: 'Hello #science' });
  console.log('post with no workflow service:', r1.status, r1.body?.error?.code, '(want 503 PROVIDER_UNAVAILABLE)');
  console.log('video unlocked again:', (await db.collection('videos').findOne({ _id: videoId }))?.status, '| posts left:', await db.collection('posts').countDocuments(), '(want ready, 0)');
  console.log('post without a session:', (await post({ caption: 'x' }, false)).status, '(want 401)');
  console.log('caption too long:', (await post({ caption: 'a'.repeat(2300) })).body?.error?.code, '(want VALIDATION)');
  console.log('time in the past:', (await post({ caption: 'x', scheduledAt: new Date(Date.now() - 60_000).toISOString() })).body?.error?.code, '(want SCHEDULE_IN_PAST)');
  console.log('unknown field:', (await post({ caption: 'x', nope: 1 })).status, '(want 400)');
  console.log('GET /api/posts/<unknown>:', (await call(`/api/posts/${new ObjectId()}`)).status, '(want 404)');
  const conn = await call('/api/instagram/connection');
  console.log('connection:', conn.status, JSON.stringify(conn.body), '| token in response:', JSON.stringify(conn.body).includes('SECRET') || /tokenEnc|tokenIv/.test(JSON.stringify(conn.body)), '(want false)');
  const me = await call('/api/me');
  console.log('me.instagram:', JSON.stringify(me.body?.instagram));
  const start = await call(`/api/instagram/connect?returnTo=${encodeURIComponent(`/videos/${videoId}/post`)}`);
  console.log('connect:', start.status, start.location?.split('?')[0], '| client_id set:', new URL(start.location!).searchParams.get('client_id') === process.env.META_APP_ID, '| scope:', new URL(start.location!).searchParams.get('scope'));
  console.log('connect signed out:', (await call('/api/instagram/connect', {}, false)).location, '(want /sign-in)');
  console.log('callback with a made-up state:', (await call('/api/instagram/callback?code=abc&state=nope')).location, '(want /settings?ig=error)');
  console.log('callback cancelled:', (await call(`/api/instagram/callback?error=access_denied&state=${new URL(start.location!).searchParams.get('state')}`)).location, '(want /videos/<id>/post?ig=cancelled)');
  const patch = await call('/api/me', { method: 'PATCH', body: JSON.stringify({ timeZone: 'Nowhere/Land' }) });
  console.log('bad time zone:', patch.status, patch.body?.error?.code, '(want 400 VALIDATION)');
  console.log('save profile:', (await call('/api/me', { method: 'PATCH', body: JSON.stringify({ name: 'Asha R', timeZone: 'America/New_York' }) })).body?.timeZone, '(want America/New_York)');
  console.log('delete without DELETE:', (await call('/api/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'no' }) })).body?.error?.code, '(want VALIDATION)');
  console.log('disconnect:', JSON.stringify((await call('/api/instagram/connection', { method: 'DELETE' })).body), '| left:', await db.collection('instagram_connections').countDocuments(), '(want 0)');
} finally {
  await r2.delete(TEST_KEY).catch(() => undefined);
  ws.close();
  chrome.kill();
  await mongoClient.close();
  await cleanup();
}
