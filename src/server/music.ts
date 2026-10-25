import { findTrack, MUSIC, type MusicTrack } from '@/config/music';
import type { StorageProvider } from '@/server/providers';
import { storageKey } from '@/server/storage/keys';

/** Tracks whose file is in storage (a track that was never uploaded is simply not offered). */
export async function availableMusic(storage: StorageProvider): Promise<MusicTrack[]> {
  const present = await Promise.all(MUSIC.map((t) => storage.exists(storageKey.music(t.id))));
  return MUSIC.filter((_, i) => present[i]);
}

/** Signed link to a track's file, or null for an unknown or missing track. */
export async function musicUrl(storage: StorageProvider, id: string, ttlSec = 3600): Promise<string | null> {
  if (!findTrack(id)) return null;
  const key = storageKey.music(id);
  return (await storage.exists(key)) ? storage.signedGet(key, ttlSec) : null;
}
