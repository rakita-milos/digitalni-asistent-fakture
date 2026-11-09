import { open } from '@op-engineering/op-sqlite';

import { SCHEMA_STATEMENTS } from './schema';

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
