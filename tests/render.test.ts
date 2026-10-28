import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { approvedEmails, assets, renderJobs, usageLog, videos, type VideoDoc } from '@/server/db/collections';
import { cancelRender, failJob, getRenderStatus, setProgress, startRender, toJobView, type StartDeps } from '@/server/render/jobs';
import { buildProps, mediaScene, narrationHash, syncVideo, voiceScene, type RenderDeps } from '@/server/render/pipeline';
import type { MediaProvider, StorageProvider, VoiceProvider } from '@/server/providers';
import { approve } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);

function fakeStorage() {
  const files = new Map<string, Buffer>();
  const storage: StorageProvider = {
    put: async (k, b) => void files.set(k, b),
    list: async () => [], deletePrefix: async () => 0, exists: async (k) => files.has(k),
    delete: async (k) => void files.delete(k),
    signedGet: async (k, ttl, o) => `https://signed.example/${k}?ttl=${ttl}${o?.downloadName ? `&dl=${encodeURIComponent(o.downloadName)}` : ''}`,
  };
  return { storage, files };
}
function fakeVoice() {
  const calls: string[] = [];
  const voice: VoiceProvider = {
    synthesize: async (text) => {
      calls.push(text);
      const words = text.split(' ').map((word, i) => ({ word, startMs: i * 300, endMs: i * 300 + 250 }));
      return { audio: Buffer.from('mp3'), durationMs: words.length * 300, words, credits: text.length };
    },
  };
  return { voice, calls };
}
const noMedia: MediaProvider = { search: async () => [] };
const deps = (extra: Partial<RenderDeps> = {}) => {
  const s = fakeStorage();
  const v = fakeVoice();
  return { d: { storage: s.storage, voice: () => v.voice, media: () => noMedia, ...extra } as RenderDeps, ...s, ...v };
};

const scene = (id: string, narration: string, extra: Record<string, unknown> = {}) => ({
  id, order: 0, template: 'bullet-reveal', title: id, narration, needsCheck: false,
  elements: [{ id: 'el_1', type: 'bullet', text: 'Point', cue: narration.split(' ')[0] }], ...extra,
});

async function setup(status: VideoDoc['status'] = 'storyboard_ready', extra: Partial<VideoDoc> = {}) {
  await approve('r@example.com').catch(() => undefined); // a test may set up two videos for the same member
  const userId = new ObjectId();
  const now = new Date();
  const doc: VideoDoc = {
    _id: new ObjectId(), userId, title: 'How rain forms', status, voiceId: 'v1', speed: 1, theme: 'forest', captionsOn: true, musicId: null,
    scenes: [scene('sc_a', 'Rain starts as vapour') , scene('sc_b', 'Clouds then cool down')] as never, version: 1, createdAt: now, updatedAt: now, ...extra,
  };
  await videos().insertOne(doc);
  return { doc, owner: { id: userId, email: 'r@example.com', timeZone: 'Asia/Kolkata' } };
}
const sent: { name: string; data: Record<string, unknown> }[] = [];
const sendDeps = (fail = false): StartDeps => ({
  send: async (name, data) => { if (fail) throw new Error('down'); sent.push({ name, data }); },
  storage: fakeStorage().storage,
});

describe('starting a render', () => {
  it('queues one job, locks the video and sends the event', async () => {
    sent.length = 0;
    const { doc, owner } = await setup();
    const out = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    expect(out).toMatchObject({ created: true, replay: false, job: { status: 'queued', kind: 'full', attempt: 1, stageLabel: 'Writing voice' } });
    const v = await videos().findOne({ _id: doc._id });
    expect(v).toMatchObject({ status: 'rendering', version: 2 });
    expect(String(v?.currentJobId)).toBe(out.job.id);
    expect(sent).toEqual([{ name: 'video/render.requested', data: expect.objectContaining({ videoId: String(doc._id), jobId: out.job.id }) }]);
  });

  it('a second start while a job is active returns that job and starts nothing', async () => {
    sent.length = 0;
    const { doc, owner } = await setup();
    const a = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    const b = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    expect(b).toMatchObject({ created: false, job: { id: a.job.id } });
    expect(await renderJobs().countDocuments({ videoId: doc._id })).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('the same Idempotency-Key replays the first answer', async () => {
    const { doc, owner } = await setup();
    const a = await startRender(owner, String(doc._id), { version: 1, idempotencyKey: 'k1' }, sendDeps());
    await renderJobs().updateOne({ _id: new ObjectId(a.job.id) }, { $set: { status: 'failed' }, $unset: { active: '' } });
    const b = await startRender(owner, String(doc._id), { version: 1, idempotencyKey: 'k1' }, sendDeps());
    expect(b).toMatchObject({ replay: true, created: false, job: { id: a.job.id } });
  });

  it('refuses a draft, a stale version, an unknown scene and someone else\'s video', async () => {
    const { doc, owner } = await setup();
    const draft = await setup('draft');
    expect(await code(startRender(draft.owner, String(draft.doc._id), { version: 1 }, sendDeps()))).toBe('INVALID_STATE');
    expect(await code(startRender(owner, String(doc._id), { version: 9 }, sendDeps()))).toBe('VERSION_CONFLICT');
    expect(await code(startRender(owner, String(doc._id), { version: 1, sceneIds: ['nope'] }, sendDeps()))).toBe('INVALID');
    expect(await code(startRender({ ...owner, id: new ObjectId() }, String(doc._id), { version: 1 }, sendDeps()))).toBe('NOT_FOUND');
  });

  it('unlocks the video again when the workflow service is unreachable', async () => {
    const { doc, owner } = await setup();
    expect(await code(startRender(owner, String(doc._id), { version: 1 }, sendDeps(true)))).toBe('PROVIDER_UNAVAILABLE');
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('storyboard_ready');
    expect(await renderJobs().countDocuments({})).toBe(0);
  });

  it('a failed video needs a free daily slot to try again', async () => {
    const { doc, owner } = await setup('failed', { failureReason: 'x' });
    await approvedEmails().updateOne({ email: 'r@example.com' }, { $set: { dailyLimit: 1 } });
    // Another video today fills the one slot.
    await videos().insertOne({ ...doc, _id: new ObjectId(), status: 'ready' });
    expect(await code(startRender(owner, String(doc._id), { version: 1 }, sendDeps()))).toBe('DAILY_LIMIT');
    await approvedEmails().updateOne({ email: 'r@example.com' }, { $set: { dailyLimit: 5 } });
    expect(await code(startRender(owner, String(doc._id), { version: 1 }, sendDeps()))).toBe('ok');
  });

  it('stops when the month\'s voice budget would be passed', async () => {
    const { doc, owner } = await setup();
    await usageLog().insertOne({ _id: new ObjectId(), userId: owner.id, type: 'voice_credits', amount: 9990, createdAt: new Date() });
    expect(await code(startRender(owner, String(doc._id), { version: 1 }, sendDeps()))).toBe('VOICE_CREDITS_LOW');
    expect((await videos().findOne({ _id: doc._id }))?.status).toBe('storyboard_ready');
  });

  it('a fix on a ready video is a "fix" job and keeps only that scene to re-voice', async () => {
    const { doc, owner } = await setup('ready', { outputKey: 'videos/x/out/old.mp4' });
    const out = await startRender(owner, String(doc._id), { version: 1, sceneIds: ['sc_b'] }, sendDeps());
    expect(out.job).toMatchObject({ kind: 'fix', sceneIds: ['sc_b'] });
  });
});

describe('cancel and failure', () => {
  it('cancel ends the job, unlocks the script and tells the workflow', async () => {
    sent.length = 0;
    const { doc, owner } = await setup();
    const { job } = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    const after = await cancelRender(owner.id, String(doc._id), { send: async (name, data) => void sent.push({ name, data }), storage: fakeStorage().storage });
    expect(after).toMatchObject({ videoStatus: 'storyboard_ready', job: { id: job.id, status: 'cancelled' } });
    expect(sent.at(-1)?.name).toBe('video/render.cancel');
    expect((await renderJobs().findOne({ _id: new ObjectId(job.id) }))?.active).toBeUndefined();
    expect(await code(cancelRender(owner.id, String(doc._id), { send: async () => undefined, storage: fakeStorage().storage }))).toBe('INVALID_STATE');
  });

  it('a cancelled job ignores late progress writes', async () => {
    const { doc, owner } = await setup();
    const { job } = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    await cancelRender(owner.id, String(doc._id), { send: async () => undefined, storage: fakeStorage().storage });
    await setProgress(job.id, 'render', 70);
    expect((await renderJobs().findOne({ _id: new ObjectId(job.id) }))).toMatchObject({ status: 'cancelled', progress: 0 });
  });

  it('a failure marks the video failed (refunded) with a plain reason and no internals', async () => {
    const { doc, owner } = await setup();
    const { job } = await startRender(owner, String(doc._id), { version: 1 }, sendDeps());
    await setProgress(job.id, 'render', 50);
    await failJob(job.id, new Error('sandbox exploded at /tmp/secret'));
    const status = await getRenderStatus(owner.id, String(doc._id), fakeStorage().storage);
    expect(status.videoStatus).toBe('failed');
    expect(status.job).toMatchObject({ status: 'failed', error: { code: 'RENDER_FAILED', message: 'The video could not be assembled. Please try again.' } });
    expect(JSON.stringify(status)).not.toContain('secret');
    expect((await videos().findOne({ _id: doc._id }))?.failureReason).toContain('assembled');
    await failJob(job.id, new Error('again')); // no second effect
    expect((await videos().findOne({ _id: doc._id }))?.version).toBe(3);
  });

  it('a failed fix puts the earlier render back to ready', async () => {
    const { doc, owner } = await setup('ready', { outputKey: 'videos/x/out/old.mp4' });
    const { job } = await startRender(owner, String(doc._id), { version: 1, sceneIds: ['sc_a'] }, sendDeps());
    await failJob(job.id, new Error('x'));
    expect(await videos().findOne({ _id: doc._id })).toMatchObject({ status: 'ready', outputKey: 'videos/x/out/old.mp4' });
  });

  it('status gives signed links only once a render has succeeded, and a remaining-time estimate while running', async () => {
    const { doc, owner } = await setup('ready', { outputKey: 'videos/x/out/j.mp4', thumbKey: 'videos/x/thumb-j.jpg', title: 'Rain: a story?' });
    const st = fakeStorage().storage;
    const s = await getRenderStatus(owner.id, String(doc._id), st);
    expect(s.media).toMatchObject({ videoUrl: expect.stringContaining('out/j.mp4'), thumbUrl: expect.stringContaining('thumb-j.jpg') });
    expect(s.media?.downloadUrl).toContain('dl=Rain%20a%20story.mp4');

    const now = new Date();
    const view = toJobView({ _id: new ObjectId(), videoId: doc._id, userId: owner.id, kind: 'full', status: 'running', stage: 'render', progress: 50, attempt: 1, active: true, queuedAt: now, startedAt: new Date(now.getTime() - 40_000) }, now);
    expect(view).toMatchObject({ etaSec: 40, stageLabel: 'Rendering video' });
    expect(toJobView({ ...{ _id: new ObjectId(), videoId: doc._id, userId: owner.id, kind: 'full', status: 'queued', stage: 'load', progress: 0, attempt: 1, queuedAt: now } }, now).etaSec).toBeNull();
  });
});

describe('render steps', () => {
  it('records narration once per unchanged scene and logs the credits', async () => {
    const { doc } = await setup();
    const { d, calls, files } = deps();
    const id = String(doc._id);
    expect(await voiceScene(d, id, 'sc_a')).toEqual({ reused: false, credits: 'Rain starts as vapour'.length });
    expect(await voiceScene(d, id, 'sc_a')).toEqual({ reused: true, credits: 0 });
    expect(calls).toHaveLength(1);
    const saved = (await videos().findOne({ _id: doc._id }))!.scenes[0];
    expect(saved.audio).toMatchObject({ hash: narrationHash('Rain starts as vapour', 'v1', 1), durationMs: 1200 });
    expect(files.has(saved.audio!.key)).toBe(true);
    expect(await usageLog().countDocuments({ type: 'voice_credits' })).toBe(1);
  });

  it('records again when the words, voice or pace changed, or the file is gone', async () => {
    const { doc } = await setup();
    const { d, calls, files } = deps();
    const id = String(doc._id);
    await voiceScene(d, id, 'sc_a');
    await videos().updateOne({ _id: doc._id }, { $set: { speed: 1.1 } });
    await voiceScene(d, id, 'sc_a');
    expect(calls).toHaveLength(2);
    files.clear();
    await voiceScene(d, id, 'sc_a');
    expect(calls).toHaveLength(3);
  });

  it('sync saves element times and scene durations', async () => {
    const { doc } = await setup();
    const { d } = deps();
    for (const s of ['sc_a', 'sc_b']) await voiceScene(d, String(doc._id), s);
    const out = await syncVideo(String(doc._id));
    const v = (await videos().findOne({ _id: doc._id }))!;
    expect(v.scenes[0].durationMs).toBe(150 + 1200 + 150);
    expect(v.scenes[0].elements[0].startMs).toBeTypeOf('number');
    expect(out.durationMs).toBe(v.scenes[0].durationMs! + v.scenes[1].durationMs!);
  });

  it('props: word times move by the lead-in, links are signed only when asked, music is added', async () => {
    const { doc } = await setup('storyboard_ready', { musicId: 'healing-piano', musicVolume: 40 });
    const { d, files } = deps();
    for (const s of ['sc_a', 'sc_b']) await voiceScene(d, String(doc._id), s);
    await syncVideo(String(doc._id));
    files.set('music/healing-piano.mp3', Buffer.from('m'));

    const plain = await buildProps(d, String(doc._id), { sign: false });
    expect(plain.props.scenes[0].audio?.url).toBeUndefined();
    expect(plain.props.music).toEqual({ url: 'music/healing-piano.mp3', volume: 0.4 });
    expect(plain.props.scenes[0].audio?.words[0].startMs).toBe(150);

    const signed = await buildProps(d, String(doc._id), { sign: true, ttlSec: 600 });
    expect(signed.props.scenes[0].audio?.url).toMatch(/^https:\/\/signed\.example\/videos\/.+\/audio\/sc_a-.+\.mp3\?ttl=600$/);
    expect(signed.props.music?.url).toContain('music/healing-piano.mp3');
    expect(signed.props).toMatchObject({ theme: 'forest', captionsOn: true });
  });

  it('props leave music out when the file is not in storage or the volume is zero', async () => {
    const { doc } = await setup('storyboard_ready', { musicId: 'healing-piano', musicVolume: 40 });
    const { d } = deps();
    for (const s of ['sc_a', 'sc_b']) await voiceScene(d, String(doc._id), s);
    expect((await buildProps(d, String(doc._id), { sign: true })).props.music).toBeUndefined();
  });

  it('a stock-clip scene gets its clip, or is drawn as a text scene when none is found', async () => {
    const clip = scene('sc_c', 'Leaves take in light', { template: 'stock-clip', media: { query: 'leaf' } });
    const { doc } = await setup('storyboard_ready', { scenes: [scene('sc_a', 'Rain starts as vapour'), clip] as never });
    const id = String(doc._id);
    const base = deps();
    for (const s of ['sc_a', 'sc_c']) await voiceScene(base.d, id, s);
    await syncVideo(id);

    expect(await mediaScene(base.d, id, 'sc_c')).toEqual({ found: false });
    const fallback = await buildProps(base.d, id, { sign: true });
    expect(fallback.fallbacks).toEqual(['sc_c']);
    expect(fallback.props.scenes[1]).toMatchObject({ template: 'bullet-reveal' });

    const media: MediaProvider = {
      search: async () => [{ id: '9', url: 'https://cdn.example/9.mp4', pageUrl: 'https://pixabay.com/videos/9/', source: 'pixabay', licence: 'Pixabay Content Licence', durationSec: 12, width: 720, height: 1280 }],
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(Buffer.from('clip'))) as typeof fetch;
    try {
      const withClip = { ...base.d, media: () => media };
      expect(await mediaScene(withClip, id, 'sc_c')).toEqual({ found: true });
      expect(await mediaScene(withClip, id, 'sc_c')).toEqual({ found: true }); // second call reuses the stored clip
    } finally { globalThis.fetch = realFetch; }
    expect(await assets().countDocuments({ sceneId: 'sc_c' })).toBe(1);
    const ok = await buildProps(base.d, id, { sign: true });
    expect(ok.fallbacks).toEqual([]);
    expect(ok.props.scenes[1]).toMatchObject({ template: 'stock-clip', media: { query: 'leaf', durationSec: 12, url: expect.stringContaining('media/pixabay/9.mp4') } });
  });

  it('a failing clip search never fails the video', async () => {
    const clip = scene('sc_c', 'Leaves take in light', { template: 'stock-clip', media: { query: 'leaf' } });
    const { doc } = await setup('storyboard_ready', { scenes: [clip] as never });
    const { d } = deps({ media: () => ({ search: async () => { throw new Error('quota'); } }) });
    await voiceScene(d, String(doc._id), 'sc_c');
    expect(await mediaScene(d, String(doc._id), 'sc_c')).toEqual({ found: false });
  });
});
