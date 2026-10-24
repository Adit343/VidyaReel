import { MongoClient } from 'mongodb';
import { env } from '@/server/env';

const globalForMongo = globalThis as unknown as { _mongo?: MongoClient };

export function getClient() {
  if (!globalForMongo._mongo) {
    globalForMongo._mongo = new MongoClient(env().MONGODB_URI);
  }
  return globalForMongo._mongo;
}

// Never fall back to the driver's default `test` database (shared clusters hold other projects).
const uriDbName = (uri: string) => decodeURIComponent(new URL(uri.replace('mongodb+srv:', 'https:').replace('mongodb:', 'http:')).pathname.slice(1));
export const db = () => getClient().db(uriDbName(env().MONGODB_URI) || 'vidyareel');
