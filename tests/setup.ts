import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

// In-memory cookie jar standing in for next/headers cookies().
export const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: `${mongo.getUri()}vidyareel_test`, APP_URL: 'http://localhost:3000',
    ADMIN_EMAIL: 'owner@example.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret',
  });
  delete process.env.RESEND_API_KEY;
  const { ensureIndexes } = await import('@/server/db/indexes');
  await ensureIndexes();
});

beforeEach(async () => {
  jar.clear();
  const { db } = await import('@/server/db/client');
  for (const c of await db().collections()) await c.deleteMany({});
});

afterAll(async () => {
  const { getClient } = await import('@/server/db/client');
  await getClient().close();
  await mongo.stop();
});
