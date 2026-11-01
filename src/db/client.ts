import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getDevDb } from './dev-db';

let dbInstance: any = null;
let initializedWorkspace = false;

async function ensureDefaultWorkspace(dbToSeed: any) {
  if (initializedWorkspace) return;
  try {
    await dbToSeed.insert(schema.workspaces).values({
      id: 'ws_default',
      name: 'Default Workspace',
      settingsJson: { outboundEnabled: true },
    }).onConflictDoNothing();
    initializedWorkspace = true;
  } catch (e) {
    // Non-blocking if table or network isn't ready
  }
}

export async function getDbAsync() {
  if (dbInstance) {
    await ensureDefaultWorkspace(dbInstance);
    return dbInstance;
  }

  if (process.env.DATABASE_URL && process.env.USE_REAL_POSTGRES !== 'false') {
    const client = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzlePg(client, { schema });
    await ensureDefaultWorkspace(dbInstance);
    return dbInstance;
  }

  // Fallback to embedded PGlite for self-contained testing if no DATABASE_URL
  dbInstance = await getDevDb();
  return dbInstance;
}

export function setDb(customDb: any) {
  dbInstance = customDb;
}

export function getDb() {
  if (!dbInstance) {
    if (process.env.DATABASE_URL && process.env.USE_REAL_POSTGRES !== 'false') {
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

