import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getDevDb } from './dev-db';

let dbInstance: any = null;

export async function getDbAsync() {
  if (dbInstance) return dbInstance;

  if (process.env.USE_REAL_POSTGRES === 'true' && process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzlePg(client, { schema });
    return dbInstance;
  }

  // By default, use embedded PGlite for self-contained, reproducible execution
  dbInstance = await getDevDb();
  return dbInstance;
}

export function setDb(customDb: any) {
  dbInstance = customDb;
}

export function getDb() {
  if (!dbInstance) {
    if (process.env.USE_REAL_POSTGRES === 'true' && process.env.DATABASE_URL) {
      const client = postgres(process.env.DATABASE_URL, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      dbInstance = drizzlePg(client, { schema });
      return dbInstance;
    }
    throw new Error('Database not initialized. Call await getDbAsync() first.');
  }
  return dbInstance;
}

export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getDb();
    return (instance as any)[prop];
  },
});

