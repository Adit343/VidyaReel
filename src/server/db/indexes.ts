import { db } from './client';

export async function ensureIndexes() {
  const d = db();
  await d.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { googleId: 1 }, unique: true, sparse: true },
  ]);
  await d.collection('sessions').createIndexes([
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);
  await d.collection('password_resets').createIndexes([
    { key: { tokenHash: 1 }, unique: true },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);
  await d.collection('approved_emails').createIndex({ email: 1 }, { unique: true });
  await d.collection('videos').createIndexes([
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, status: 1 } },
  ]);
  await d.collection('render_jobs').createIndexes([
    { key: { videoId: 1, queuedAt: -1 } },
    // One active job per video; a second start finds the first instead of racing it.
    { key: { videoId: 1, active: 1 }, unique: true, partialFilterExpression: { active: true } },
    { key: { userId: 1, idempotencyKey: 1 }, unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
  ]);
  await d.collection('assets').createIndexes([
    { key: { videoId: 1 } },
    { key: { source: 1, sourceId: 1 } },
  ]);
  await d.collection('instagram_connections').createIndexes([
    { key: { userId: 1 }, unique: true },
    { key: { status: 1, tokenExpiresAt: 1 } },
  ]);
  await d.collection('posts').createIndexes([
    { key: { status: 1, scheduledAt: 1 } },
    { key: { videoId: 1, createdAt: -1 } },
    // One live (scheduled or publishing) post per video; a second start finds the first instead of racing it.
    { key: { videoId: 1, live: 1 }, unique: true, partialFilterExpression: { live: true } },
    { key: { userId: 1, idempotencyKey: 1 }, unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
  ]);
  await d.collection('usage_log').createIndex({ userId: 1, type: 1, createdAt: -1 });
  await d.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection('oauth_states').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
