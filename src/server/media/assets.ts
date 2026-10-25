import { ObjectId } from 'mongodb';
import { assets } from '@/server/db/collections';
import type { MediaCandidate, MediaProvider, StorageProvider } from '@/server/providers';
import { storageKey } from '@/server/storage/keys';

/**
 * Finds a clip for a scene's search query, copies the file into our own storage (so the render never
 * depends on the provider's servers) and records its licence. Returns null when nothing fits.
 */
export async function attachClip(
  deps: { media: MediaProvider; storage: StorageProvider; fetchFn?: typeof fetch },
  scene: { videoId: ObjectId; sceneId: string; query: string; minSec: number },
): Promise<{ assetId: string; candidate: MediaCandidate } | null> {
  const [best] = await deps.media.search(scene.query, { orientation: 'portrait', minSec: scene.minSec });
  if (!best) return null;
  const res = await (deps.fetchFn ?? fetch)(best.url);
  if (!res.ok) throw new Error(`Could not download the clip (${res.status})`);
  const key = storageKey.media(best.source, best.id);
  await deps.storage.put(key, Buffer.from(await res.arrayBuffer()), 'video/mp4');
  const doc = {
    _id: new ObjectId(), videoId: scene.videoId, sceneId: scene.sceneId, kind: 'clip' as const, source: best.source,
    sourceId: best.id, sourceUrl: best.pageUrl, licence: best.licence, ...(best.attribution ? { attribution: best.attribution } : {}),
    storageKey: key, createdAt: new Date(),
  };
  await assets().insertOne(doc);
  return { assetId: doc._id.toHexString(), candidate: best };
}
