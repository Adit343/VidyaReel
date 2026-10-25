'use client';
import { Player } from '@remotion/player';
import { useMemo } from 'react';
import type { Scene } from '@/lib/schemas/storyboard';
import { Video } from '@/remotion/Video';
import type { SceneView } from '@/server/videos/view';

const FPS = 30;

/**
 * The real video template for one scene, frozen late in the scene so every line has appeared. It is the same
 * component the renderer uses, so diagrams, themes and layouts match the finished video (the narration, captions
 * and any stock clip are not part of it).
 */
export default function ScenePreviewPlayer({ scene, theme }: { scene: SceneView; theme: string }) {
  const { scenes, frames, frame } = useMemo(() => {
    const lastStart = 300 + Math.max(0, scene.elements.length - 1) * 1200;
    const durationMs = Math.max(scene.durationMs ?? scene.estimatedSec * 1000, lastStart + 1500);
    const s: Scene = {
      id: scene.id, order: scene.order, template: scene.template, diagram: scene.diagram ?? undefined,
      title: scene.title ?? undefined, narration: scene.narration, needsCheck: false, durationMs,
      elements: scene.elements.map((e) => ({ ...e })),
      ...(scene.template === 'stock-clip' ? { media: { query: scene.title ?? '' } } : {}),
    };
    return { scenes: [s], frames: Math.round((durationMs / 1000) * FPS), frame: Math.round(((lastStart + 900) / 1000) * FPS) };
  }, [scene.id, scene.order, scene.template, scene.diagram, scene.title, scene.narration, scene.durationMs, scene.estimatedSec, scene.elements]);

  return (
    <Player
      component={Video}
      inputProps={{ scenes, theme, captionsOn: false }}
      durationInFrames={frames} compositionWidth={1080} compositionHeight={1920} fps={FPS}
      initialFrame={Math.min(frame, frames - 1)} controls={false} clickToPlay={false} doubleClickToFullscreen={false}
      acknowledgeRemotionLicense
      style={{ width: '100%', height: '100%' }}
    />
  );
}
