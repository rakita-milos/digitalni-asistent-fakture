import { open } from '@op-engineering/op-sqlite';

import { SCHEMA_STATEMENTS } from './schema';

/**
 * Mini-migracije za postojeće instalacije (CREATE TABLE IF NOT EXISTS ne mijenja tabelu).
 * SQLite ne podržava `ADD COLUMN IF NOT EXISTS`, pa se greška „duplicate column“ ignoriše.
 */
const MIGRATIONS: string[] = [
  'ALTER TABLE sync_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE sync_queue ADD COLUMN nextAttemptAt TEXT',
];

/** Minimalni SQL interfejs — olakšava testiranje i zamjenu adaptera. */
export interface SqlDb {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

let instance: SqlDb | null = null;

export function getDb(): SqlDb {
  if (instance) {
    return instance;
  }

  const native = open({ name: 'digitalni-asistent.sqlite' });

  const ready = (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await native.execute(statement);
    }
    for (const statement of MIGRATIONS) {
      try {
        await native.execute(statement);
      } catch {
        // Kolona već postoji (svježa instalacija) — migracija je idempotentna.
      }
    }
  })();

  instance = {
    async execute(sql, params = []) {
      await ready;
      await native.execute(sql, params as never[]);
    },
    async query<T>(sql: string, params: unknown[] = []) {
      await ready;
      const result = await native.execute(sql, params as never[]);
      return (result.rows ?? []) as T[];
    },
  };

  return instance;
}
