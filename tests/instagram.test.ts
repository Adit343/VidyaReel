import { ObjectId } from 'mongodb';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { instagramConnections, oauthStates, posts, sessions, videos, type PostDoc, type VideoDoc } from '@/server/db/collections';
import { createInstagramPublisher, InstagramError } from '@/server/instagram/api';
import {
  disconnect, finishConnect, getConnection, refreshDueTokens, safeReturnTo, startConnect,
} from '@/server/instagram/connection';
import { decryptToken, encryptToken } from '@/server/instagram/crypto';
import { checkContainer, claim, currentRun, ensureContainer, failPost, finish, startOfRun, toPostError, type PublishDeps } from '@/server/posts/publish';
import { createPost, retryPost, updatePost, type PostDeps } from '@/server/posts/service';
import { deleteMyData } from '@/server/account';
import type { SocialPublisher, StorageProvider } from '@/server/providers';
import { approve } from './helpers';

const KEY = 'a'.repeat(64);
beforeAll(() => {
  Object.assign(process.env, { IG_TOKEN_KEY: KEY, META_APP_ID: 'app123', META_APP_SECRET: 'secret', APP_URL: 'http://localhost:3000' });
  delete process.env.META_REDIRECT_URI;
  delete process.env.IG_ALLOWED_ACCOUNT_TYPES;
});

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const sent: { name: string; data: Record<string, unknown> }[] = [];
const deps = (fail = false): PostDeps => ({ send: async (name, data) => { if (fail) throw new Error('down'); sent.push({ name, data }); } });

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

async function setup(extra: Partial<VideoDoc> = {}, opts: { connected?: boolean; status?: 'connected' | 'needs_reconnect' } = {}) {
  await approve('p@example.com').catch(() => undefined);
  const userId = new ObjectId();
  const now = new Date();
  const doc: VideoDoc = {
    _id: new ObjectId(), userId, title: 'How rain forms', status: 'ready', scenes: [], version: 1, createdAt: now, updatedAt: now,
    outputKey: 'videos/x/out/j.mp4', output: { sizeBytes: 5_000_000, validatedAt: now, durationMs: 30_000 }, ...extra,
  };
  await videos().insertOne(doc);
  if (opts.connected !== false) {
    await instagramConnections().insertOne({
      _id: new ObjectId(), userId, igUserId: '17841', username: 'asha.explains', accountType: 'BUSINESS', ...encryptToken('LONG-TOKEN'),
      tokenExpiresAt: new Date(Date.now() + 50 * 24 * 3600e3), scopes: [], status: opts.status ?? 'connected', connectedAt: now,
    });
  }
  return { doc, userId, owner: { id: userId, email: 'p@example.com', timeZone: 'Asia/Kolkata' } };
}

describe('token encryption', () => {
  it('round-trips, uses a new IV each time, and never stores the token as text', () => {
    const a = encryptToken('IGQ-secret-token');
    const b = encryptToken('IGQ-secret-token');
    expect(decryptToken(a)).toBe('IGQ-secret-token');
    expect(a.tokenIv).not.toBe(b.tokenIv);
    expect(JSON.stringify(a)).not.toContain('IGQ-secret-token');
  });
  it('rejects a changed ciphertext and a different key', () => {
    const a = encryptToken('tok');
    expect(() => decryptToken({ ...a, tokenEnc: encryptToken('other').tokenEnc })).toThrow();
    expect(() => decryptToken(a, 'b'.repeat(64))).toThrow();
  });
  it('accepts a base64 key and refuses a short one', () => {
    const b64 = Buffer.alloc(32, 7).toString('base64');
    expect(decryptToken(encryptToken('x', b64), b64)).toBe('x');
    expect(() => encryptToken('x', 'short')).toThrow(/32 bytes/);
  });
});

describe('connect flow', () => {
  const fakeFetch = (account = 'BUSINESS', fail?: string): typeof fetch => (async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (fail && url.includes(fail)) return json({ error: { message: 'bad code', code: 100 } }, 400);
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) {
      return json({ data: [{ access_token: 'SHORT', user_id: '17841', permissions: 'instagram_business_basic,instagram_business_content_publish' }] });
    }
    if (url.includes('/access_token?')) return json({ access_token: 'LONG-TOKEN', expires_in: 5184000 });
    if (url.includes('/me?')) return json({ user_id: '17841', username: 'asha.explains', account_type: account, profile_picture_url: 'https://cdn/p.jpg' });
    return json({}, 404);
  }) as typeof fetch;

  it('connect builds the Meta URL with a one-time state and only allows in-app return paths', async () => {
    const userId = new ObjectId();
    const url = new URL(await startConnect(userId, '/videos/1/post'));
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('app123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/instagram/callback');
    expect(url.searchParams.get('scope')).toContain('instagram_business_content_publish');
    const saved = await oauthStates().findOne({ state: url.searchParams.get('state')! });
    expect(saved).toMatchObject({ purpose: 'instagram', returnTo: '/videos/1/post' });
    expect(saved?.userId?.equals(userId)).toBe(true);
    expect(safeReturnTo('https://evil.example')).toBe('/settings');
    expect(safeReturnTo('//evil.example')).toBe('/settings');
    expect(safeReturnTo('/videos/1/post')).toBe('/videos/1/post');
  });

  async function begin(userId: ObjectId, returnTo = '/videos/1/post') {
    return new URL(await startConnect(userId, returnTo)).searchParams.get('state')!;
  }

  it('saves the account with an encrypted token and redirects with ig=connected', async () => {
    const userId = new ObjectId();
    const state = await begin(userId);
    const to = await finishConnect(userId, { code: 'abc#_', state }, { ...deps(), fetch: fakeFetch() });
    expect(to).toBe('/videos/1/post?ig=connected');
    const c = await instagramConnections().findOne({ userId });
    expect(c).toMatchObject({ username: 'asha.explains', accountType: 'BUSINESS', status: 'connected', igUserId: '17841' });
    expect(JSON.stringify(c)).not.toContain('LONG-TOKEN');
    expect(decryptToken(c!)).toBe('LONG-TOKEN');
    const view = await getConnection(userId);
    expect(view.connection?.username).toBe('asha.explains');
    expect(JSON.stringify(view)).not.toMatch(/token(Enc|Iv|Tag)|LONG/);
  });

  it('the state works once only, and only for the member who started it', async () => {
    const userId = new ObjectId();
    const state = await begin(userId);
    expect(await finishConnect(new ObjectId(), { code: 'c', state }, { ...deps(), fetch: fakeFetch() })).toBe('/settings?ig=error');
    expect(await finishConnect(userId, { code: 'c', state }, { ...deps(), fetch: fakeFetch() })).toBe('/videos/1/post?ig=connected');
    expect(await finishConnect(userId, { code: 'c', state }, { ...deps(), fetch: fakeFetch() })).toBe('/settings?ig=error');
    expect(await finishConnect(userId, { code: 'c', state: 'nope' }, { ...deps(), fetch: fakeFetch() })).toBe('/settings?ig=error');
  });

  it('a cancelled authorisation saves nothing', async () => {
    const userId = new ObjectId();
    const state = await begin(userId, '/settings');
    expect(await finishConnect(userId, { error: 'access_denied', state }, { ...deps(), fetch: fakeFetch() })).toBe('/settings?ig=cancelled');
    expect(await instagramConnections().countDocuments({ userId })).toBe(0);
  });

  it('a personal account is not eligible and nothing is saved (IG_NOT_ELIGIBLE)', async () => {
    const userId = new ObjectId();
    const state = await begin(userId);
    expect(await finishConnect(userId, { code: 'c', state }, { ...deps(), fetch: fakeFetch('PERSONAL') })).toBe('/videos/1/post?ig=not_eligible');
    expect(await instagramConnections().countDocuments({ userId })).toBe(0);
  });

  it('a Creator account (Meta says MEDIA_CREATOR) is accepted; IG_ALLOWED_ACCOUNT_TYPES can narrow that', async () => {
    const a = new ObjectId();
    expect(await finishConnect(a, { code: 'c', state: await begin(a) }, { ...deps(), fetch: fakeFetch('MEDIA_CREATOR') })).toContain('ig=connected');
    expect((await instagramConnections().findOne({ userId: a }))?.accountType).toBe('CREATOR');
    process.env.IG_ALLOWED_ACCOUNT_TYPES = 'BUSINESS';
    const b = new ObjectId();
    expect(await finishConnect(b, { code: 'c', state: await begin(b) }, { ...deps(), fetch: fakeFetch('MEDIA_CREATOR') })).toContain('ig=not_eligible');
    delete process.env.IG_ALLOWED_ACCOUNT_TYPES;
  });

  it('an Instagram failure while exchanging the code ends as ig=error', async () => {
    const userId = new ObjectId();
    const state = await begin(userId);
    expect(await finishConnect(userId, { code: 'c', state }, { ...deps(), fetch: fakeFetch('BUSINESS', 'oauth/access_token') })).toBe('/videos/1/post?ig=error');
  });

  it('reconnecting resumes the paused scheduled posts', async () => {
    const { doc, userId } = await setup({}, { status: 'needs_reconnect' });
    const when = new Date(Date.now() + 3600e3);
    await posts().insertOne({
      _id: new ObjectId(), videoId: doc._id, userId, connectionId: new ObjectId(), caption: 'c', mode: 'scheduled', scheduledAt: when,
      status: 'scheduled', retryCount: 0, live: true, paused: true, rev: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    sent.length = 0;
    await finishConnect(userId, { code: 'c', state: await begin(userId) }, { ...deps(), fetch: fakeFetch() });
    const p = await posts().findOne({ videoId: doc._id });
    expect(p?.paused).toBeUndefined();
    expect(p?.rev).toBe(2);
    expect(sent).toEqual([{ name: 'post/requested', data: { postId: String(p!._id), userId: String(userId), rev: 2 } }]);
    expect((await instagramConnections().findOne({ userId }))?.status).toBe('connected');
  });
});

describe('createPost (POST /api/videos/:id/post)', () => {
  it('posts now: a publishing post, the video becomes scheduled, the workflow event goes out', async () => {
    const { doc, owner } = await setup();
    sent.length = 0;
    const { post } = await createPost(owner, String(doc._id), { caption: 'Hello #science' }, deps());
    expect(post).toMatchObject({ status: 'publishing', mode: 'now', scheduledAt: null, caption: 'Hello #science' });
    expect(sent[0]).toMatchObject({ name: 'post/requested', data: { postId: post.id, rev: 1 } });
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('scheduled');
  });

  it('schedules for a future time', async () => {
    const { doc, owner } = await setup();
    const at = iso(3 * 3600e3);
    const { post } = await createPost(owner, String(doc._id), { caption: 'x', scheduledAt: at }, deps());
    expect(post).toMatchObject({ status: 'scheduled', mode: 'scheduled', scheduledAt: at });
  });

  it('refuses a past time, an over-long caption and too many hashtags', async () => {
    const { doc, owner } = await setup();
    expect(await code(createPost(owner, String(doc._id), { caption: 'x', scheduledAt: iso(-60_000) }, deps()))).toBe('SCHEDULE_IN_PAST');
    expect(await code(createPost(owner, String(doc._id), { caption: 'a'.repeat(2201) }, deps()))).toBe('VALIDATION');
    expect(await code(createPost(owner, String(doc._id), { caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ') }, deps()))).toBe('VALIDATION');
    expect(await code(createPost(owner, String(doc._id), { caption: 'x', scheduledAt: iso(90 * 24 * 3600e3) }, deps()))).toBe('VALIDATION');
    expect(await posts().countDocuments()).toBe(0);
  });

  it('needs a connected account (IG_NOT_CONNECTED, IG_NEEDS_RECONNECT)', async () => {
    const a = await setup({}, { connected: false });
    expect(await code(createPost(a.owner, String(a.doc._id), { caption: 'x' }, deps()))).toBe('IG_NOT_CONNECTED');
    const b = await setup({}, { status: 'needs_reconnect' });
    expect(await code(createPost(b.owner, String(b.doc._id), { caption: 'x' }, deps()))).toBe('IG_NEEDS_RECONNECT');
  });

  it('needs a ready video whose file meets Instagram limits (INVALID_STATE, VIDEO_NOT_POSTABLE)', async () => {
    const draft = await setup({ status: 'storyboard_ready' });
    expect(await code(createPost(draft.owner, String(draft.doc._id), { caption: 'x' }, deps()))).toBe('INVALID_STATE');
    const big = await setup({ output: { sizeBytes: 200 * 1024 * 1024, validatedAt: new Date(), durationMs: 30_000 } });
    expect(await code(createPost(big.owner, String(big.doc._id), { caption: 'x' }, deps()))).toBe('VIDEO_NOT_POSTABLE');
    const long = await setup({ output: { sizeBytes: 1000, validatedAt: new Date(), durationMs: 120_000 } });
    expect(await code(createPost(long.owner, String(long.doc._id), { caption: 'x' }, deps()))).toBe('VIDEO_NOT_POSTABLE');
    const none = await setup({ outputKey: undefined, output: undefined });
    expect(await code(createPost(none.owner, String(none.doc._id), { caption: 'x' }, deps()))).toBe('VIDEO_NOT_POSTABLE');
  });

  it('only one live post per video; the same Idempotency-Key replays the first post', async () => {
    const { doc, owner } = await setup();
    const first = await createPost(owner, String(doc._id), { caption: 'x', idempotencyKey: 'k1' }, deps());
    const again = await createPost(owner, String(doc._id), { caption: 'x', idempotencyKey: 'k1' }, deps());
    expect(again.replay).toBe(true);
    expect(again.post.id).toBe(first.post.id);
    expect(await code(createPost(owner, String(doc._id), { caption: 'y' }, deps()))).toBe('INVALID_STATE');
    expect(await posts().countDocuments({ videoId: doc._id })).toBe(1);
  });

  it('warns before posting a posted video again (ALREADY_POSTED) and posts after confirmRepost', async () => {
    const { doc, owner } = await setup({ status: 'posted' });
    await posts().insertOne({
      _id: new ObjectId(), videoId: doc._id, userId: owner.id, connectionId: new ObjectId(), caption: 'old', mode: 'now', status: 'posted',
      retryCount: 0, rev: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    const err = await createPost(owner, String(doc._id), { caption: 'x' }, deps()).catch((e: AppError) => e);
    expect(err).toMatchObject({ code: 'ALREADY_POSTED', status: 409 });
    expect((err as AppError).details?.postedAt).toBeTruthy();
    const { post } = await createPost(owner, String(doc._id), { caption: 'x', confirmRepost: true }, deps());
    expect(post.status).toBe('publishing');
  });

  it('keeps other members out: someone else\'s video is a 404', async () => {
    const { doc } = await setup();
    const other = { id: new ObjectId(), email: 'o@example.com' };
    expect(await code(createPost(other, String(doc._id), { caption: 'x' }, deps()))).toBe('NOT_FOUND');
  });

  it('undoes the post when the workflow service is down', async () => {
    const { doc, owner } = await setup();
    expect(await code(createPost(owner, String(doc._id), { caption: 'x' }, deps(true)))).toBe('PROVIDER_UNAVAILABLE');
    expect(await posts().countDocuments()).toBe(0);
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('ready');
  });
});

describe('reschedule, cancel, retry', () => {
  async function scheduled() {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    return { ...s, post };
  }

  it('reschedule changes the time and starts a new run; the old run is retired by `rev`', async () => {
    const { owner, post } = await scheduled();
    sent.length = 0;
    const at = iso(5 * 3600e3);
    const out = await updatePost(owner.id, post.id, { scheduledAt: at }, deps());
    expect(out).toMatchObject({ status: 'scheduled', scheduledAt: at });
    expect(sent).toEqual([{ name: 'post/requested', data: { postId: post.id, userId: String(owner.id), rev: 2 } }]);
    expect(await currentRun(post.id, 1)).toBeNull();
    expect(await currentRun(post.id, 2)).not.toBeNull();
    expect(await code(updatePost(owner.id, post.id, { scheduledAt: iso(-1000) }, deps()))).toBe('SCHEDULE_IN_PAST');
  });

  it('cancel ends the post and returns the video to ready', async () => {
    const { owner, post, doc } = await scheduled();
    sent.length = 0;
    expect((await updatePost(owner.id, post.id, { cancel: true }, deps())).status).toBe('cancelled');
    expect(sent[0].name).toBe('post/cancel');
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('ready');
    expect((await posts().findOne({ _id: new ObjectId(post.id) }))?.live).toBeUndefined();
    expect(await code(updatePost(owner.id, post.id, { cancel: true }, deps()))).toBe('INVALID_STATE');
  });

  it('a publishing post can no longer be changed, and other members get a 404', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x' }, deps());
    expect(await code(updatePost(s.owner.id, post.id, { cancel: true }, deps()))).toBe('INVALID_STATE');
    expect(await code(updatePost(new ObjectId(), post.id, { cancel: true }, deps()))).toBe('NOT_FOUND');
  });

  it('retry puts a failed post back to publishing (and drops a container Instagram rejected)', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x' }, deps());
    await posts().updateOne({ _id: new ObjectId(post.id) }, { $set: { containerId: 'C1' } });
    await failPost(post.id, new InstagramError('rejected', 'Instagram refused it'));
    expect((await videos().findOne({ _id: s.doc._id }))?.status).toBe('ready');
    expect(await code(retryPost(s.owner.id, String(new ObjectId()), deps()))).toBe('NOT_FOUND');
    sent.length = 0;
    const out = await retryPost(s.owner.id, post.id, deps());
    expect(out).toMatchObject({ status: 'publishing', error: null, retryCount: 1 });
    expect((await posts().findOne({ _id: new ObjectId(post.id) }))?.containerId).toBeUndefined();
    expect(sent[0].data.rev).toBe(2);
    expect((await videos().findOne({ _id: s.doc._id }))?.status).toBe('scheduled');
    expect(await code(retryPost(s.owner.id, post.id, deps()))).toBe('INVALID_STATE');
  });
});

describe('publishing steps', () => {
  function fakes(over: Partial<SocialPublisher> = {}) {
    const calls: string[] = [];
    const publisher: SocialPublisher = {
      createContainer: async (c, url, caption) => { calls.push(`container:${c.accessToken}:${url}:${caption}`); return 'C-1'; },
      status: async () => 'FINISHED',
      statusMessage: async () => 'Instagram does not support this video format.',
      publish: async () => ({ mediaId: 'M-1', permalink: 'https://www.instagram.com/reel/abc/' }),
      ...over,
    };
    const storage = { signedGet: async (k: string, ttl: number) => `https://signed/${k}?ttl=${ttl}` } as unknown as StorageProvider;
    return { d: { publisher, storage } as PublishDeps, calls };
  }
  async function postNow() {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'Hi #a' }, deps());
    return { ...s, postId: post.id };
  }

  it('goes through container, poll and publish, saving the permalink and marking the video posted', async () => {
    const { d, calls } = fakes();
    const { postId, doc } = await postNow();
    expect(await startOfRun(postId, 1)).toMatchObject({ scheduledAtMs: null });
    expect(await claim(postId, 1)).toBe('go');
    const id = await ensureContainer(d, postId);
    expect(id).toBe('C-1');
    expect(calls[0]).toBe('container:LONG-TOKEN:https://signed/videos/x/out/j.mp4?ttl=3600:Hi #a');
    expect(await ensureContainer(d, postId)).toBe('C-1');
    expect(calls).toHaveLength(1); // the saved container is reused, never created twice
    expect(await checkContainer(d, postId, id)).toBe('FINISHED');
    expect(await finish(d, postId, id)).toEqual({ permalink: 'https://www.instagram.com/reel/abc/' });
    const p = await posts().findOne({ _id: new ObjectId(postId) });
    expect(p).toMatchObject({ status: 'posted', igMediaId: 'M-1', permalink: 'https://www.instagram.com/reel/abc/' });
    expect(p?.live).toBeUndefined();
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('posted');
    expect(await finish(d, postId, id)).toEqual({ permalink: 'https://www.instagram.com/reel/abc/' }); // a replayed step
  });

  it('a scheduled post is claimed once at its time and marked late when it ran well after', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    expect((await startOfRun(post.id, 1))?.scheduledAtMs).toBe(new Date(post.scheduledAt!).getTime());
    const late = new Date(new Date(post.scheduledAt!).getTime() + 10 * 60_000);
    expect(await claim(post.id, 1, late)).toBe('go');
    expect(await claim(post.id, 1, late)).toBe('go'); // already publishing: the same run may claim again after a retry
    const p = await posts().findOne({ _id: new ObjectId(post.id) });
    expect(p).toMatchObject({ status: 'publishing', lateByMs: 10 * 60_000 });
    expect(await claim(post.id, 99)).toBe('stale');
  });

  it('a cancelled or rescheduled post is stale for the old run', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    await updatePost(s.owner.id, post.id, { cancel: true }, deps());
    expect(await startOfRun(post.id, 1)).toBeNull();
    expect(await claim(post.id, 1)).toBe('stale');
  });

  it('a scheduled post waits (paused) while the connection needs reconnecting', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    await instagramConnections().updateOne({ userId: s.userId }, { $set: { status: 'needs_reconnect' } });
    expect(await claim(post.id, 1)).toBe('paused');
    const p = await posts().findOne({ _id: new ObjectId(post.id) });
    expect(p).toMatchObject({ status: 'scheduled', paused: true });
    const view = await import('@/server/posts/service').then((m) => m.toPostView(p!));
    expect(view.paused).toBe(true);
  });

  it('Instagram refusing the video fails the post with IG_REJECTED and Instagram\'s reason', async () => {
    const { d } = fakes({ status: async () => 'ERROR' });
    const { postId, doc } = await postNow();
    await claim(postId, 1);
    const id = await ensureContainer(d, postId);
    const err = await checkContainer(d, postId, id).catch((e) => e);
    expect(err).toMatchObject({ code: 'IG_REJECTED', message: 'Instagram does not support this video format.', final: true });
    await failPost(postId, err);
    const p = await posts().findOne({ _id: new ObjectId(postId) });
    expect(p).toMatchObject({ status: 'failed', error: { code: 'IG_REJECTED' } });
    expect(p?.live).toBeUndefined();
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('ready');
  });

  it('a dead token fails the post, flags the connection and pauses the member\'s other scheduled posts', async () => {
    const { d } = fakes({ createContainer: async () => { throw new InstagramError('auth', 'Error validating access token', 400, 190); } });
    const other = await setup();
    // a second video of the same member, scheduled
    const second: VideoDoc = { ...other.doc, _id: new ObjectId() };
    await videos().insertOne(second);
    const { post: later } = await createPost(other.owner, String(second._id), { caption: 'later', scheduledAt: iso(3600e3) }, deps());
    const { post } = await createPost(other.owner, String(other.doc._id), { caption: 'now' }, deps());
    await claim(post.id, 1);
    const err = await ensureContainer(d, post.id).catch((e) => e);
    expect(err.code).toBe('IG_NEEDS_RECONNECT');
    await failPost(post.id, err);
    expect((await posts().findOne({ _id: new ObjectId(post.id) }))?.error?.code).toBe('IG_NEEDS_RECONNECT');
    expect((await instagramConnections().findOne({ userId: other.userId }))?.status).toBe('needs_reconnect');
    expect((await posts().findOne({ _id: new ObjectId(later.id) }))?.paused).toBe(true);
  });

  it('network and server errors are retryable; failPost on an ended post changes nothing', async () => {
    expect(toPostError(new InstagramError('transient', 'down', 503))).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', final: false });
    expect(toPostError(new Error('boom'))).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    const { postId } = await postNow();
    await failPost(postId, new InstagramError('rejected', 'no'));
    const first = await posts().findOne({ _id: new ObjectId(postId) });
    await failPost(postId, new InstagramError('auth', 'late'));
    expect((await posts().findOne({ _id: new ObjectId(postId) }) as PostDoc).error).toEqual(first!.error);
  });
});

describe('Instagram client', () => {
  const reply = (routes: Record<string, () => Response>): typeof fetch => (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.keys(routes).find((k) => url.includes(k));
    return hit ? routes[hit]() : new Response('{}', { status: 404 });
  }) as typeof fetch;
  const json = (b: unknown, status = 200) => () => new Response(JSON.stringify(b), { status });
  const conn = { igUserId: '17841', accessToken: 'T' };

  it('creates a REELS container, reads its status and publishes with a permalink', async () => {
    const seen: string[] = [];
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(`${init?.method ?? 'GET'} ${String(input).split('?')[0]} ${init?.body ? String(init.body) : ''}`);
      const url = String(input);
      if (url.endsWith('/17841/media')) return new Response(JSON.stringify({ id: 'C1' }));
      if (url.includes('/C1?fields=status_code')) return new Response(JSON.stringify({ status_code: 'IN_PROGRESS' }));
      if (url.endsWith('/17841/media_publish')) return new Response(JSON.stringify({ id: 'M1' }));
      if (url.includes('/M1?')) return new Response(JSON.stringify({ permalink: 'https://www.instagram.com/reel/x/' }));
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    const api = createInstagramPublisher(f);
    expect(await api.createContainer(conn, 'https://signed', 'cap')).toBe('C1');
    expect(seen[0]).toContain('media_type=REELS');
    expect(seen[0]).toContain('video_url=https%3A%2F%2Fsigned');
    expect(await api.status(conn, 'C1')).toBe('IN_PROGRESS');
    expect(await api.publish(conn, 'C1')).toEqual({ mediaId: 'M1', permalink: 'https://www.instagram.com/reel/x/' });
  });

  it('maps errors: 190 is auth, 5xx and rate limits are transient, other 4xx are rejected', async () => {
    const make = (b: unknown, status: number) => createInstagramPublisher(reply({ '/media': json(b, status) }));
    const kind = (p: Promise<unknown>) => p.then(() => 'ok', (e: InstagramError) => e.kind);
    expect(await kind(make({ error: { message: 'expired', type: 'OAuthException', code: 190 } }, 400).createContainer(conn, 'u', 'c'))).toBe('auth');
    expect(await kind(make({ error: { message: 'oops' } }, 503).createContainer(conn, 'u', 'c'))).toBe('transient');
    expect(await kind(make({ error: { message: 'slow down', code: 4 } }, 400).createContainer(conn, 'u', 'c'))).toBe('transient');
    expect(await kind(make({ error: { message: 'bad video', code: 100 } }, 400).createContainer(conn, 'u', 'c'))).toBe('rejected');
    const down = createInstagramPublisher((async () => { throw new Error('ECONNRESET'); }) as typeof fetch);
    expect(await kind(down.createContainer(conn, 'u', 'c'))).toBe('transient');
  });

  it('explains a container error in plain words', async () => {
    const api = createInstagramPublisher(reply({ 'fields=status': json({ status: 'ERROR: Media upload has failed with error code 2207026' }) }));
    expect(await api.statusMessage(conn, 'C1')).toBe('Instagram does not support this video format.');
  });
});

describe('daily token refresh and disconnect', () => {
  const fetchOk = ((async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('refresh_access_token')) return new Response(JSON.stringify({ access_token: 'FRESH', expires_in: 5184000 }));
    if (url.includes('/me?')) return new Response(JSON.stringify({ user_id: '17841', username: 'asha.explains', account_type: 'BUSINESS', profile_picture_url: 'https://cdn/new.jpg' }));
    return new Response('{}', { status: 404 });
  }) as typeof fetch);

  it('renews a token that expires soon, and leaves a fresh one and a day-old one alone', async () => {
    const soon = await setup();
    await instagramConnections().updateOne({ userId: soon.userId }, { $set: { tokenExpiresAt: new Date(Date.now() + 3 * 24 * 3600e3), connectedAt: new Date(Date.now() - 40 * 24 * 3600e3) } });
    const fresh = await setup();
    const young = await setup();
    await instagramConnections().updateOne({ userId: young.userId }, { $set: { tokenExpiresAt: new Date(Date.now() + 3 * 24 * 3600e3), connectedAt: new Date(), lastRefreshAt: new Date() } });
    const out = await refreshDueTokens(fetchOk);
    expect(out).toMatchObject({ refreshed: 1, failed: 0 });
    const c = await instagramConnections().findOne({ userId: soon.userId });
    expect(decryptToken(c!)).toBe('FRESH');
    expect(c!.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 3600e3);
    expect(decryptToken((await instagramConnections().findOne({ userId: fresh.userId }))!)).toBe('LONG-TOKEN');
    expect(decryptToken((await instagramConnections().findOne({ userId: young.userId }))!)).toBe('LONG-TOKEN');
  });

  it('a revoked token becomes needs_reconnect and pauses scheduled posts; a network error is tried again later', async () => {
    const s = await setup();
    await instagramConnections().updateOne({ userId: s.userId }, { $set: { tokenExpiresAt: new Date(Date.now() + 2 * 24 * 3600e3), connectedAt: new Date(Date.now() - 40 * 24 * 3600e3) } });
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    const net = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await refreshDueTokens(net)).toMatchObject({ failed: 1, needsReconnect: 0 });
    expect((await instagramConnections().findOne({ userId: s.userId }))?.status).toBe('connected');
    const revoked = (async () => new Response(JSON.stringify({ error: { message: 'revoked', type: 'OAuthException', code: 190 } }), { status: 400 })) as unknown as typeof fetch;
    expect(await refreshDueTokens(revoked)).toMatchObject({ needsReconnect: 1 });
    expect((await instagramConnections().findOne({ userId: s.userId }))?.status).toBe('needs_reconnect');
    expect((await posts().findOne({ _id: new ObjectId(post.id) }))?.paused).toBe(true);
  });

  it('disconnect deletes the token and cancels scheduled posts', async () => {
    const s = await setup();
    const { post } = await createPost(s.owner, String(s.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    expect(await disconnect(s.userId, deps())).toEqual({ cancelledPosts: 1 });
    expect(await instagramConnections().countDocuments({ userId: s.userId })).toBe(0);
    expect((await posts().findOne({ _id: new ObjectId(post.id) }))?.status).toBe('cancelled');
    expect((await videos().findOne({ _id: s.doc._id }))?.status).toBe('ready');
    expect(await getConnection(s.userId)).toEqual({ connected: false, connection: null });
  });

  it('delete my data soft-deletes videos, removes the connection and ends sessions', async () => {
    const s = await setup();
    await sessions().insertOne({ _id: new ObjectId(), userId: s.userId, tokenHash: 'h', expiresAt: new Date(Date.now() + 1e6), createdAt: new Date() });
    await deleteMyData(s.userId, deps());
    expect((await videos().findOne({ _id: s.doc._id }))?.deletedAt).toBeInstanceOf(Date);
    expect(await instagramConnections().countDocuments({ userId: s.userId })).toBe(0);
    expect(await sessions().countDocuments({ userId: s.userId })).toBe(0);
  });
});

describe('listPosts (Posts screen)', () => {
  it('lists the member\'s posts with video titles, newest first, and hides other members\' and deleted videos\' posts', async () => {
    const { listPosts } = await import('@/server/posts/service');
    const a = await setup({ title: 'First' });
    const { post } = await createPost(a.owner, String(a.doc._id), { caption: 'x', scheduledAt: iso(3600e3) }, deps());
    const b = await setup({ title: 'Second' });
    await createPost(b.owner, String(b.doc._id), { caption: 'y' }, deps());
    const rows = await listPosts(a.userId);
    expect(rows.map((r) => [r.id, r.title])).toEqual([[post.id, 'First']]);
    await videos().updateOne({ _id: a.doc._id }, { $set: { deletedAt: new Date() } });
    expect(await listPosts(a.userId)).toEqual([]);
  });
});
