// Phase 1 experiment 5: publish a Reel from a signed R2 URL with the Instagram API (Instagram Login).
// Needs IG_SPIKE_USER_ID and IG_SPIKE_TOKEN in .env.local (see docs/Phase-1-Spike-Results.md) and a
// rendered video in R2 (run `npm run spike:sandbox` first; it uploads spike/sandbox-render.mp4).
// Usage: tsx scripts/spike-instagram.mts [--publish]   (without --publish it stops after the container is FINISHED)
import nextEnv from '@next/env';
import { createR2Storage } from '../src/server/storage';

nextEnv.loadEnvConfig(process.cwd());

const API = 'https://graph.instagram.com/v23.0';
const userId = process.env.IG_SPIKE_USER_ID;
const token = process.env.IG_SPIKE_TOKEN;
if (!userId || !token) throw new Error('Set IG_SPIKE_USER_ID and IG_SPIKE_TOKEN in .env.local.');
const publish = process.argv.includes('--publish');
const KEY = 'spike/sandbox-render.mp4';

async function call<T>(path: string, init?: { method: 'POST'; params: Record<string, string> }): Promise<T> {
  const params = new URLSearchParams({ ...(init?.params ?? {}), access_token: token! });
  const res = await fetch(init ? `${API}${path}` : `${API}${path}${path.includes('?') ? '&' : '?'}${params}`, {
    method: init?.method ?? 'GET',
    ...(init ? { body: params, headers: { 'content-type': 'application/x-www-form-urlencoded' } } : {}),
  });
  const body = (await res.json()) as T & { error?: { message: string; code: number; error_subcode?: number } };
  if (!res.ok || body.error) throw new Error(`Instagram ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  return body;
}

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

const me = await call<{ username?: string; account_type?: string }>(`/me?fields=username,account_type`);
console.log(`account: @${me.username} (${me.account_type})`);

const videoUrl = await createR2Storage().signedGet(KEY, 3600);
const container = await call<{ id: string }>(`/${userId}/media`, {
  method: 'POST',
  params: { media_type: 'REELS', video_url: videoUrl, caption: 'Vidyareel spike test #education' },
});
console.log(`[${secs()}] container ${container.id} created`);

let status = '';
for (let i = 0; i < 60; i++) {
  const s = await call<{ status_code: string; status?: string }>(`/${container.id}?fields=status_code,status`);
  if (s.status_code !== status) { status = s.status_code; console.log(`[${secs()}] status ${status}${s.status ? ` (${s.status})` : ''}`); }
  if (status === 'FINISHED' || status === 'ERROR' || status === 'EXPIRED') break;
  await new Promise((r) => setTimeout(r, 5000));
}
if (status !== 'FINISHED') throw new Error(`Container did not finish: ${status}`);

if (!publish) {
  console.log('Container is ready. Rerun with --publish to post it.');
} else {
  const media = await call<{ id: string }>(`/${userId}/media_publish`, { method: 'POST', params: { creation_id: container.id } });
  const info = await call<{ permalink?: string }>(`/${media.id}?fields=permalink`);
  console.log(`[${secs()}] PUBLISHED media ${media.id}\npermalink: ${info.permalink}`);
}
