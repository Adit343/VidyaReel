import { MongoClient } from 'mongodb';

const globalForMongo = globalThis as unknown as { _mongo?: MongoClient };

export function getClient() {
  if (!globalForMongo._mongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    globalForMongo._mongo = new MongoClient(uri);
  }
  return globalForMongo._mongo;
}

export const db = () => getClient().db();
