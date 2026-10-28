import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider } from '@/server/providers';
import { env } from '@/server/env';

export { storageKey } from './keys';

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function r2Config(): R2Config {
  const e = env();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = e;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.');
  }
  return { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
}

/** Cloudflare R2 through its S3-compatible API. The bucket stays private: callers get signed URLs only. */
export function createR2Storage(cfg: R2Config = r2Config(), endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com`): StorageProvider {
  const client = new S3Client({
    region: 'auto', endpoint, forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return {
    async put(key, body, type) {
      await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: type }));
    },
    signedGet: (key, ttlSec, opts) => getSignedUrl(client, new GetObjectCommand({
      Bucket: cfg.bucket, Key: key,
      ...(opts?.downloadName ? { ResponseContentDisposition: `attachment; filename="${opts.downloadName.replace(/[^\w .()-]/g, '')}"` } : {}),
    }), { expiresIn: ttlSec }),
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
        return true;
      } catch (e) {
        if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
        throw e;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    },
    async deletePrefix(prefix) {
      let deleted = 0;
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length) {
          await client.send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: keys, Quiet: true } }));
          deleted += keys.length;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return deleted;
    },
  };
}

let shared: StorageProvider | undefined;
export const storage = (): StorageProvider => (shared ??= createR2Storage());
