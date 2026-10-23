import { MongoClient } from 'mongodb';
import { env } from '@/server/env';

const globalForMongo = globalThis as unknown as { _mongo?: MongoClient };

export function getClient() {
  if (!globalForMongo._mongo) {
    globalForMongo._mongo = new MongoClient(env().MONGODB_URI);
  }
  return globalForMongo._mongo;
}

export const db = () => getClient().db();
