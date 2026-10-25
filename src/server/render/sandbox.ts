import path from 'node:path';
import { addBundleToSandbox, createSandbox, renderMediaOnVercel, renderStillOnVercel } from '@remotion/vercel';
import { Sandbox } from '@vercel/sandbox';
import type { RenderProps } from './pipeline';

/**
 * Vercel Sandbox helpers for the render workflow. Each function is one Inngest step, so the
 * sandbox is addressed by `name` between steps and no step has to outlive a platform time limit.
 * The bundle comes from `npm run remotion:bundle` (built ahead of time, not at request time).
 */
const bundleDir = () => path.resolve(process.env.REMOTION_BUNDLE_DIR ?? 'build/remotion-bundle');

export async function startSandbox(): Promise<string> {
  const sandbox = await createSandbox({ timeoutInMilliseconds: 15 * 60 * 1000 });
  return sandbox.name;
}

export async function uploadBundle(name: string): Promise<void> {
  const sandbox = await Sandbox.get({ name, resume: true });
  // addBundleToSandbox makes each sub-folder of the bundle (for example `public/`) without making the bundle folder
  // itself first, which fails as soon as the bundle has a sub-folder; make the folder ourselves.
  await sandbox.mkDir('remotion-bundle').catch(() => undefined);
  await addBundleToSandbox({ sandbox, bundleDir: bundleDir() });
}

/** Renders the `Video` composition from the given props; `onProgress` gets 0 to 1. */
export async function renderScenes(
  name: string, props: RenderProps, onProgress?: (fraction: number) => Promise<void> | void,
): Promise<{ filePath: string; contentType: string }> {
  const sandbox = await Sandbox.get({ name, resume: true });
  const { sandboxFilePath, contentType } = await renderMediaOnVercel({
    sandbox, compositionId: 'Video', inputProps: props, codec: 'h264',
    onProgress: onProgress ? (p) => onProgress(p.overallProgress) : undefined,
  });
  return { filePath: sandboxFilePath, contentType };
}

/** One frame of the video as a JPEG, used as the poster image. */
export async function renderPoster(name: string, props: RenderProps, frame = 45): Promise<{ filePath: string }> {
  const sandbox = await Sandbox.get({ name, resume: true });
  const { sandboxFilePath } = await renderStillOnVercel({
    sandbox, compositionId: 'Video', inputProps: props, frame, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5,
  });
  return { filePath: sandboxFilePath };
}

export async function readRendered(name: string, filePath: string): Promise<Buffer> {
  const sandbox = await Sandbox.get({ name, resume: true });
  const file = await sandbox.readFileToBuffer({ path: filePath });
  if (!file) throw new Error(`Rendered file missing in sandbox: ${filePath}`);
  return file;
}

export async function stopSandbox(name: string): Promise<void> {
  const sandbox = await Sandbox.get({ name }).catch(() => undefined);
  await sandbox?.stop().catch(() => undefined);
}
