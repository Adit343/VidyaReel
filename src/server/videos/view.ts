import { clock } from '@/lib/time';
import type { Scene } from '@/lib/schemas/storyboard';
import type { VideoStatus } from '@/lib/schemas/video';
import type { VideoDoc } from '@/server/db/collections';
import { estimateSec, wordCount } from '@/server/ai/storyboard';

/** One scene as the browser sees it: no word times, no storage keys. */
export type SceneView = {
  id: string; order: number; template: Scene['template']; title: string | null; narration: string;
  onScreenText: string[]; needsCheck: boolean; checkNote: string | null; elements: { id: string; type: string; text: string; cue: string }[];
  words: number; estimatedSec: number; durationMs: number | null; hasAudio: boolean;
};

/** The Video object of API-Design 6.4 (the parts that exist so far). */
export type VideoView = {
  id: string; version: number; title: string; topic: string; lengthSec: number; language: string; audience: string;
  angle: string | null; status: VideoStatus; failureReason: string | null; voiceId: string; speed: number; theme: string;
  accent: string; musicId: string | null; captionsOn: boolean; caption: string; hashtags: string[];
  estimatedSec: number; warnings: string[]; scenes: SceneView[]; createdAt: string; updatedAt: string;
};

const sceneView = (s: Scene): SceneView => ({
  id: s.id, order: s.order, template: s.template, title: s.title ?? null, narration: s.narration,
  onScreenText: s.elements.map((e) => e.text), needsCheck: s.needsCheck, checkNote: s.checkNote ?? null,
  elements: s.elements.map((e) => ({ id: e.id, type: e.type, text: e.text, cue: e.cue })),
  words: wordCount(s.narration), estimatedSec: estimateSec([s]), durationMs: s.durationMs ?? null, hasAudio: !!s.audio,
});

/** Soft warning when the narration runs more than 10% over the chosen length (API-Design 6.7). */
export function warningsFor(scenes: { narration: string }[], lengthSec: number) {
  const est = estimateSec(scenes);
  const over = Math.round((est / lengthSec - 1) * 100);
  return over > 10 ? [`Narration is ${over}% longer than ${clock(lengthSec)}`] : [];
}

export function toVideoView(v: VideoDoc): VideoView {
  const lengthSec = v.lengthSec ?? 60;
  return {
    id: String(v._id), version: v.version, title: v.title, topic: v.topic ?? '', lengthSec, language: v.language ?? 'en',
    audience: v.audience ?? 'General', angle: v.angle ?? null, status: v.status, failureReason: v.failureReason ?? null,
    voiceId: v.voiceId ?? '', speed: v.speed ?? 1, theme: v.theme ?? 'forest', accent: v.accent ?? '#145A41',
    musicId: v.musicId ?? null, captionsOn: v.captionsOn ?? true, caption: v.caption ?? '', hashtags: v.hashtags ?? [],
    estimatedSec: estimateSec(v.scenes), warnings: warningsFor(v.scenes, lengthSec),
    scenes: v.scenes.map(sceneView), createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}
