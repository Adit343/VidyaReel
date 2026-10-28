import { gzipSync } from 'node:zlib';
import { BSON } from 'mongodb';
import { log } from '@/lib/log';
import { db } from '@/server/db/client';
import type { StorageProvider } from '@/server/providers';

export const BACKUP_PREFIX = 'backups/';
export const KEEP = 4;
// The collections worth restoring after a disaster (docs/Database-Design.md section 8). Instagram tokens stay encrypted,
// exactly as stored. Sessions, rate limits and OAuth states are left out on purpose: they expire anyway.
const COLLECTIONS = ['approved_emails', 'users', 'videos', 'posts', 'instagram_connections', 'usage_log'] as const;

/**
 * Weekly export: one gzip file `backups/YYYY-MM-DD.json.gz` (extended JSON, so ids and dates restore with their types)
 * in the private bucket, then the oldest files beyond the newest four are deleted. Atlas M0 has no automatic backups.
 */
export async function exportBackup(store: StorageProvider, now = new Date()) {
  const data: Record<string, unknown[]> = {};
  for (const name of COLLECTIONS) data[name] = await db().collection(name).find({}).toArray();
  const body = gzipSync(Buffer.from(BSON.EJSON.stringify({ exportedAt: now, collections: data }, { relaxed: false })));
  const key = `${BACKUP_PREFIX}${now.toISOString().slice(0, 10)}.json.gz`;
  await store.put(key, body, 'application/gzip');

  const old = (await store.list(BACKUP_PREFIX)).sort().reverse().slice(KEEP);
  for (const k of old) await store.delete(k);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  log('info', 'backup written', { key, bytes: body.length, pruned: old.length, ...counts });
  return { key, bytes: body.length, pruned: old.length, counts };
}
