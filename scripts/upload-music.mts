// Uploads assets/music/<file> for each track in src/config/music.ts to R2 and records its licence in `assets`.
// Safe to repeat: files are overwritten and the licence row is updated, not duplicated.
import { existsSync, readFileSync } from 'node:fs';
import { ObjectId } from 'mongodb';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const { MUSIC, MUSIC_LICENCE } = await import('../src/config/music');
const { assets } = await import('../src/server/db/collections');
const { storage } = await import('../src/server/storage');
const { storageKey } = await import('../src/server/storage/keys');

let missing = 0;
for (const t of MUSIC) {
  const path = `assets/music/${t.file}`;
  if (!existsSync(path)) { console.log(`missing ${path}`); missing++; continue; }
  const key = storageKey.music(t.id);
  await storage().put(key, readFileSync(path), 'audio/mpeg');
  await assets().updateOne(
    { kind: 'music', sourceId: t.id },
    {
      $set: { source: 'pixabay', sourceUrl: t.pageUrl, licence: MUSIC_LICENCE, attribution: `${t.name} by ${t.author} (Pixabay)`, storageKey: key },
      $setOnInsert: { _id: new ObjectId(), createdAt: new Date() },
    },
    { upsert: true },
  );
  console.log(`uploaded ${t.id} -> ${key}`);
}
process.exit(missing ? 1 : 0);
