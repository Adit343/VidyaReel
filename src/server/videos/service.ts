import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import { DEFAULT_MUSIC_VOLUME, findTrack } from '@/config/music';
import { VOICES } from '@/config/voices';
import { AppError } from '@/lib/errors';
import type { Scene } from '@/lib/schemas/storyboard';
import type { createVideoSchema, sceneEditSchema, updateVideoSchema } from '@/lib/schemas/video';
import { getLlm } from '@/server/ai';
import { guardLlm, limitLlm } from '@/server/ai/limit';
import {
  assertSafeTopic, estimateSec, generateStoryboard, newSceneId, regenerateScene,
} from '@/server/ai/storyboard';
import { videos, type VideoDoc } from '@/server/db/collections';
import { getQuota } from '@/server/quota';
import { toVideoView, type VideoView } from './view';

export type Owner = { id: ObjectId; email: string; timeZone?: string };

const renumber = (scenes: Scene[]) => scenes.map((s, order) => ({ ...s, order }));
const inputOf = (v: VideoDoc) => ({
  topic: v.topic ?? v.title, lengthSec: v.lengthSec ?? 60, audience: v.audience ?? 'General', angle: v.angle, language: v.language ?? 'en',
});

/** The member's own, non-deleted video; anyone else's id is a plain 404. */
export async function loadOwned(userId: ObjectId, id: string): Promise<VideoDoc> {
  const found = ObjectId.isValid(id)
    ? await videos().findOne({ _id: new ObjectId(id), userId, deletedAt: { $exists: false } })
    : null;
  if (!found) throw new AppError('NOT_FOUND', 'Video not found.', 404);
  return found;
}

function assertEditable(v: VideoDoc, version: number) {
  if (v.status === 'rendering') throw new AppError('VIDEO_LOCKED', 'This video is being rendered. Wait for it to finish.', 409);
  if (v.version !== version) throw new AppError('VERSION_CONFLICT', 'This video changed elsewhere. Reload to see the latest.', 409);
}

/** Compare-and-set on `version`: the write only lands if nobody else saved since the caller read it. */
async function commit(v: VideoDoc, set: Partial<VideoDoc>, unset: (keyof VideoDoc)[] = []): Promise<VideoView> {
  const res = await videos().findOneAndUpdate(
    { _id: v._id, userId: v.userId, version: v.version, deletedAt: { $exists: false } },
    {
      $set: { ...set, updatedAt: new Date() }, $inc: { version: 1 },
      ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ''])) } : {}),
    },
    { returnDocument: 'after' },
  );
  if (!res) throw new AppError('VERSION_CONFLICT', 'This video changed elsewhere. Reload to see the latest.', 409);
  return toVideoView(res);
}

const withScenes = (scenes: Scene[]): Partial<VideoDoc> => {
  const ordered = renumber(scenes);
  return { scenes: ordered, estimatedSec: estimateSec(ordered) };
};

export async function getVideo(userId: ObjectId, id: string) {
  return toVideoView(await loadOwned(userId, id));
}

/**
 * Create a video and write its storyboard (API-Design 6.3). Order: daily cap, AI rate limit, safety check,
 * draft row (this is what counts toward the cap), storyboard. A failed storyboard leaves the draft as `failed`
 * (refunded by the quota rule) so "Try again" can regenerate it.
 */
export async function createVideo(owner: Owner, input: z.infer<typeof createVideoSchema>) {
  const quota = await getQuota(owner.id, owner.email, owner.timeZone);
  if (quota.left <= 0) throw new AppError('DAILY_LIMIT', `You have used all ${quota.limit} videos today.`, 429);
  await limitLlm(owner.id);
  const llm = getLlm();
  await guardLlm(() => assertSafeTopic(llm, input.topic));

  const now = new Date();
  const voiceId = VOICES.some((v) => v.id === input.voiceId) ? input.voiceId! : VOICES[0].id;
  const draft: VideoDoc = {
    _id: new ObjectId(), userId: owner.id, title: input.topic.slice(0, 60), status: 'draft', topic: input.topic,
    angle: input.angle, lengthSec: input.lengthSec, language: input.language, audience: input.audience,
    voiceId, speed: 1, theme: 'forest', accent: '#145A41', musicId: null, musicVolume: DEFAULT_MUSIC_VOLUME, captionsOn: true, caption: '', hashtags: [],
    estimatedSec: 0, safety: { checkedAt: now, result: 'ok' }, scenes: [], version: 1, createdAt: now, updatedAt: now,
  };
  await videos().insertOne(draft);
  return fillStoryboard(draft, true);
}

/** Runs the storyboard call for a draft or failed video and saves the result, or marks the video failed. */
async function fillStoryboard(v: VideoDoc, isNew: boolean): Promise<VideoView> {
  try {
    const sb = await guardLlm(() => generateStoryboard(getLlm(), inputOf(v)));
    return await commit(v, {
      ...withScenes(sb.scenes), title: sb.title.trim(), accent: sb.accent ?? v.accent, caption: sb.caption.trim(),
      hashtags: sb.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)), status: 'storyboard_ready',
    }, ['failureReason']);
  } catch (e) {
    if (e instanceof AppError && (e.code === 'STORYBOARD_FAILED' || e.code === 'PROVIDER_UNAVAILABLE')) {
      // A video that already has a good storyboard keeps it; only a draft with nothing to show is marked failed (and refunded).
      const empty = v.status === 'draft' || v.status === 'failed';
      const failed = empty
        ? await videos().findOneAndUpdate(
          { _id: v._id, userId: v.userId },
          { $set: { status: 'failed', failureReason: 'We could not write the script.', updatedAt: new Date() }, $inc: { version: 1 } },
          { returnDocument: 'after' },
        )
        : v;
      throw new AppError(e.code, e.message, e.status, undefined, {
        videoId: String(v._id), version: failed?.version ?? v.version + 1, created: isNew,
      });
    }
    throw e;
  }
}

/** Whole storyboard again for the same inputs. No new daily-cap row, except when a failed video is revived. */
export async function regenerateVideo(owner: Owner, id: string, version: number) {
  const v = await loadOwned(owner.id, id);
  assertEditable(v, version);
  if (v.status === 'failed') {
    const quota = await getQuota(owner.id, owner.email, owner.timeZone);
    if (quota.left <= 0) throw new AppError('DAILY_LIMIT', `You have used all ${quota.limit} videos today.`, 429);
  }
  await limitLlm(owner.id);
  return fillStoryboard(v, false);
}

export async function updateVideo(userId: ObjectId, id: string, body: z.infer<typeof updateVideoSchema>) {
  const v = await loadOwned(userId, id);
  assertEditable(v, body.version);
  const { version: _version, ...fields } = body;
  void _version;
  if (fields.voiceId && !VOICES.some((x) => x.id === fields.voiceId)) throw new AppError('INVALID', 'Unknown voice.', 400);
  if (fields.musicId && !findTrack(fields.musicId)) throw new AppError('INVALID', 'Unknown music track.', 400);
  return commit(v, fields as Partial<VideoDoc>);
}

const findScene = (v: VideoDoc, sceneId: string) => {
  const at = v.scenes.findIndex((s) => s.id === sceneId);
  if (at < 0) throw new AppError('NOT_FOUND', 'Scene not found.', 404);
  return at;
};

export async function editScene(userId: ObjectId, id: string, sceneId: string, body: z.infer<typeof sceneEditSchema>) {
  const v = await loadOwned(userId, id);
  assertEditable(v, body.version);
  const at = findScene(v, sceneId);
  let scene: Scene = { ...v.scenes[at] };

  if (body.title !== undefined) scene.title = body.title.trim() || undefined;
  if (body.onScreenText) {
    const first = scene.narration.split(/\s+/).slice(0, 3).join(' ');
    scene.elements = body.onScreenText.map((text, n) => ({
      ...(scene.elements[n] ?? { id: `el_${n + 1}`, type: 'bullet', cue: first }), text: text.trim(),
    }));
  }
  if (body.narration !== undefined && body.narration !== scene.narration) {
    // Edited words make the stored voice and timings stale; they are rebuilt on the next render.
    const { audio: _audio, durationMs: _dur, ...rest } = scene;
    void _audio; void _dur;
    scene = { ...rest, narration: body.narration };
  }

  let scenes = v.scenes.map((s, n) => (n === at ? scene : s));
  if (body.moveTo !== undefined) {
    const to = Math.min(body.moveTo, scenes.length - 1);
    const [moved] = scenes.splice(at, 1);
    scenes = [...scenes.slice(0, to), moved, ...scenes.slice(to)];
  }
  return commit(v, withScenes(scenes));
}

export async function deleteScene(userId: ObjectId, id: string, sceneId: string, version: number) {
  const v = await loadOwned(userId, id);
  assertEditable(v, version);
  const at = findScene(v, sceneId);
  if (v.scenes.length <= 1) throw new AppError('INVALID', 'A video needs at least one scene.', 400);
  return commit(v, withScenes(v.scenes.filter((_, n) => n !== at)));
}

/** A blank scene the member writes themselves (the "+ Add new scene beat" button). */
export async function addScene(userId: ObjectId, id: string, version: number, afterSceneId?: string) {
  const v = await loadOwned(userId, id);
  assertEditable(v, version);
  if (v.scenes.length >= 12) throw new AppError('INVALID', 'A video can have at most 12 scenes.', 400);
  const at = afterSceneId ? findScene(v, afterSceneId) + 1 : v.scenes.length;
  const blank: Scene = {
    id: newSceneId(), order: at, template: 'bullet-reveal', title: 'New scene', needsCheck: false,
    narration: 'Write what the narrator should say in this scene.',
    elements: [{ id: 'el_1', type: 'bullet', text: 'Key point', cue: 'Write what' }],
  };
  return commit(v, withScenes([...v.scenes.slice(0, at), blank, ...v.scenes.slice(at)]));
}

export async function regenerateOneScene(owner: Owner, id: string, sceneId: string, version: number, instruction?: string, signal?: AbortSignal) {
  const v = await loadOwned(owner.id, id);
  assertEditable(v, version);
  const at = findScene(v, sceneId);
  await limitLlm(owner.id);
  const others = v.scenes.filter((_, n) => n !== at).map((s) => s.narration);
  const fresh = await guardLlm(() => regenerateScene(getLlm(), inputOf(v), v.scenes[at], others, instruction)).catch((e) => {
    if (e instanceof AppError && e.code === 'STORYBOARD_FAILED') {
      throw new AppError('STORYBOARD_FAILED', 'We could not rewrite that scene. Try again.', 422);
    }
    throw e;
  });
  // The member pressed Cancel while the model was thinking: leave the video untouched.
  if (signal?.aborted) throw new AppError('INVALID', 'Cancelled.', 499);
  return commit(v, withScenes(v.scenes.map((s, n) => (n === at ? fresh : s))));
}
