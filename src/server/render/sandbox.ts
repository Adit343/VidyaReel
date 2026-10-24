import path from 'node:path';
import { addBundleToSandbox, createSandbox, renderMediaOnVercel } from '@remotion/vercel';
import { Sandbox } from '@vercel/sandbox';
import type { Scene } from '@/lib/schemas/storyboard';

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
  await addBundleToSandbox({ sandbox, bundleDir: bundleDir() });
}

export async function renderScenes(name: string, scenes: Scene[]): Promise<{ filePath: string; contentType: string }> {
  const sandbox = await Sandbox.get({ name, resume: true });
  const { sandboxFilePath, contentType } = await renderMediaOnVercel({
    sandbox, compositionId: 'Video', inputProps: { scenes }, codec: 'h264',
  });
  return { filePath: sandboxFilePath, contentType };
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
