import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { findTrack } from '@/config/music';
import { storyboardSchema, type Scene } from '@/lib/schemas/storyboard';
import { assets, usageLog, videos, type VideoDoc } from '@/server/db/collections';
import { attachClip } from '@/server/media/assets';
import type { MediaProvider, StorageProvider, VoiceProvider } from '@/server/providers';
import { storageKey } from '@/server/storage/keys';
import { LEAD_IN_MS, syncScene } from '@/server/sync';

export type RenderDeps = { storage: StorageProvider; voice: () => VoiceProvider; media: () => MediaProvider };

/** Narration audio is reused when the words, voice and pace are unchanged (System-Design 7.2). */
export const narrationHash = (narration: string, voiceId: string, speed: number) =>
  createHash('sha1').update(`${voiceId}|${speed}|${narration}`).digest('hex').slice(0, 12);

const sceneOf = (v: VideoDoc, sceneId: string) => {
  const s = v.scenes.find((x) => x.id === sceneId);
  if (!s) throw new Error(`Scene ${sceneId} not found`);
  return s;
};

const loadVideo = async (videoId: string) => {
  const v = await videos().findOne({ _id: new ObjectId(videoId) });
  if (!v) throw new Error(`Video ${videoId} not found`);
  return v;
};

/** Characters that still need to be spoken (scenes with no matching saved audio); the monthly budget check uses it. */
export async function missingVoiceChars(deps: Pick<RenderDeps, 'storage'>, v: VideoDoc): Promise<number> {
  const voiceId = v.voiceId ?? '';
  const speed = v.speed ?? 1;
  const need = await Promise.all(v.scenes.map(async (s) => {
    const fresh = s.audio?.hash === narrationHash(s.narration, voiceId, speed) && (await deps.storage.exists(s.audio.key));
    return fresh ? 0 : s.narration.length;
  }));
  return need.reduce((a, b) => a + b, 0);
}

/** Step `voice:<sceneId>`: record the narration unless the saved recording still matches. */
export async function voiceScene(deps: RenderDeps, videoId: string, sceneId: string): Promise<{ reused: boolean; credits: number }> {
  const v = await loadVideo(videoId);
  const scene = sceneOf(v, sceneId);
  const voiceId = v.voiceId ?? '';
  const speed = v.speed ?? 1;
  const hash = narrationHash(scene.narration, voiceId, speed);
  if (scene.audio?.hash === hash && (await deps.storage.exists(scene.audio.key))) return { reused: true, credits: 0 };

  const r = await deps.voice().synthesize(scene.narration, { voiceId, speed });
  const key = storageKey.audio(videoId, sceneId, hash);
  await deps.storage.put(key, r.audio, 'audio/mpeg');
  await videos().updateOne(
    { _id: v._id, 'scenes.id': sceneId },
    { $set: { 'scenes.$.audio': { key, hash, durationMs: r.durationMs, words: r.words } } },
  );
  await usageLog().insertOne({ _id: new ObjectId(), userId: v.userId, videoId: v._id, type: 'voice_credits', amount: r.credits, createdAt: new Date() });
  return { reused: false, credits: r.credits };
}

/** Step `sync`: put every element on the voice clock and save each scene's duration. */
export async function syncVideo(videoId: string): Promise<{ durationMs: number; warnings: string[] }> {
  const v = await loadVideo(videoId);
  const warnings: string[] = [];
  const scenes = v.scenes.map((s) => {
    if (!s.audio) throw new Error(`Scene ${s.id} has no narration audio`);
    const r = syncScene(s, s.audio.words, s.audio.durationMs);
    r.warnings.forEach((w) => warnings.push(`${s.id}: ${w}`));
    return { ...s, elements: r.elements, durationMs: r.durationMs };
  });
  await videos().updateOne({ _id: v._id }, { $set: { scenes } });
  return { durationMs: scenes.reduce((n, s) => n + (s.durationMs ?? 0), 0), warnings };
}

/**
 * Step `media:<sceneId>`: find, copy and license a stock clip for a stock-clip scene. Returns false when no
 * clip fits (the props builder then draws the scene as a plain text scene instead).
 */
export async function mediaScene(deps: RenderDeps, videoId: string, sceneId: string): Promise<{ found: boolean }> {
  const v = await loadVideo(videoId);
  const scene = sceneOf(v, sceneId);
  if (scene.template !== 'stock-clip' || !scene.media?.query) return { found: false };

  if (scene.media.assetId && ObjectId.isValid(scene.media.assetId)) {
    const have = await assets().findOne({ _id: new ObjectId(scene.media.assetId) });
    if (have && (await deps.storage.exists(have.storageKey))) return { found: true };
  }
  const minSec = Math.max(1, Math.ceil((scene.durationMs ?? 3000) / 1000));
  let hit: Awaited<ReturnType<typeof attachClip>> = null;
  try {
    hit = await attachClip({ media: deps.media(), storage: deps.storage }, { videoId: v._id, sceneId, query: scene.media.query, minSec });
  } catch {
    hit = null; // a clip that cannot be found or copied must not fail the whole video
  }
  if (!hit) return { found: false };
  await videos().updateOne(
    { _id: v._id, 'scenes.id': sceneId },
    { $set: { 'scenes.$.media': { query: scene.media.query, assetId: hit.assetId, durationSec: hit.candidate.durationSec } } },
  );
  return { found: true };
}

export type RenderProps = {
  scenes: Scene[]; theme: string; captionsOn: boolean; music?: { url: string; volume: number };
};

/**
 * The input props of the `Video` composition. With `sign` the narration, clip and music files carry signed
 * links (valid for `ttlSec`); without it the props hold storage keys only, which is what is kept in R2 for
 * debugging. A stock-clip scene without a clip is drawn as a bullet scene so the video is never empty.
 */
export async function buildProps(
  deps: Pick<RenderDeps, 'storage'>, videoId: string, opts: { sign: boolean; ttlSec?: number },
): Promise<{ props: RenderProps; fallbacks: string[] }> {
  const v = await loadVideo(videoId);
  const ttl = opts.ttlSec ?? 3 * 3600;
  const fallbacks: string[] = [];
  const scenes: Scene[] = [];
  for (const s of v.scenes) {
    if (!s.audio) throw new Error(`Scene ${s.id} has no narration audio`);
    // Saved word times start at the audio's first sample; scene time starts a lead-in earlier.
    const audio = {
      ...s.audio,
      words: s.audio.words.map((w) => ({ ...w, startMs: w.startMs + LEAD_IN_MS, endMs: w.endMs + LEAD_IN_MS })),
      ...(opts.sign ? { url: await deps.storage.signedGet(s.audio.key, ttl) } : {}),
    };
    let next: Scene = { ...s, audio };
    if (s.template === 'stock-clip') {
      const asset = s.media?.assetId && ObjectId.isValid(s.media.assetId)
        ? await assets().findOne({ _id: new ObjectId(s.media.assetId) })
        : null;
      if (asset) {
        next = { ...next, media: { ...s.media!, ...(opts.sign ? { url: await deps.storage.signedGet(asset.storageKey, ttl) } : {}) } };
      } else {
        fallbacks.push(s.id);
        next = { ...next, template: 'bullet-reveal', media: undefined };
      }
    }
    scenes.push(next);
  }
  const track = v.musicId ? findTrack(v.musicId) : undefined;
  const musicKey = track ? storageKey.music(track.id) : null;
  const music = musicKey && (v.musicVolume ?? 0) > 0 && (await deps.storage.exists(musicKey))
    ? { url: opts.sign ? await deps.storage.signedGet(musicKey, ttl) : musicKey, volume: (v.musicVolume ?? 0) / 100 }
    : undefined;
  const props: RenderProps = { scenes: storyboardSchema.shape.scenes.parse(scenes), theme: v.theme ?? 'forest', captionsOn: v.captionsOn ?? true, ...(music ? { music } : {}) };
  return { props, fallbacks };
}
