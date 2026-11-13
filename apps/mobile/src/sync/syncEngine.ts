import type {
  SyncOperation,
  SyncOperationResult,
  SyncResultStatus,
} from '@digitalni-asistent/shared';

import { apiRequest } from '../api/client';
import type { SqlDb } from '../db/localDb';
import { getMeta, setMeta, upsertCustomers, upsertInvoices } from '../db/repos';
import { planRetry, summarizeQueue, type QueueAlarm, type RetryState } from './retry';
import type { LocalCustomer, LocalInvoice } from '../db/repos';
import { uuidv7 } from '../utils/uuid';

export interface PullResponse {
  serverTime: string;
  customers: LocalCustomer[];
  invoices: LocalInvoice[];
}

export interface PushResponse {
  serverTime: string;
  results: SyncOperationResult[];
}

export interface QueueRow {
  id: string;
  entity: 'customer' | 'invoice';
  op: 'create' | 'update';
  entityId: string;
  payload: string;
  createdAt: string;
  status: string;
  error: string | null;
  attempts: number;
  nextAttemptAt: string | null;
}

/** GET /sync/pull + upis u lokalnu bazu. */
export async function pullAndMerge(db: SqlDb): Promise<{ customers: number; invoices: number }> {
  const lastSyncAt = await getMeta(db, 'lastSyncAt');
  const suffix = lastSyncAt ? `?since=${encodeURIComponent(lastSyncAt)}` : '';
  const response = await apiRequest<PullResponse>(`/sync/pull${suffix}`);

  await upsertCustomers(db, response.customers);
  await upsertInvoices(db, response.invoices);
  await setMeta(db, 'lastSyncAt', response.serverTime);

  return { customers: response.customers.length, invoices: response.invoices.length };
}

export function buildOperations(rows: QueueRow[]): SyncOperation[] {
  return rows.map((row) => ({
    entity: row.entity,
    op: row.op,
    entityId: row.entityId,
    payload: JSON.parse(row.payload) as unknown,
  }));
}

export interface ResultPlan {
  deleteIds: string[];
  failures: Array<{ id: string; error: string }>;
}

/** Primjena odgovora push-a na lokalni queue (applied/duplicate → briši, failed → označi). */
export function planResultApplication(
  rows: QueueRow[],
  results: SyncOperationResult[],
): ResultPlan {
  const byEntityId = new Map<string, SyncOperationResult>();
  for (const result of results) {
    byEntityId.set(result.entityId, result);
  }

  const deleteIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const row of rows) {
    const result = byEntityId.get(row.entityId);
    if (!result) {
      continue;
    }
    if (result.status === 'applied' || result.status === 'duplicate') {
      deleteIds.push(row.id);
    } else {
      failures.push({ id: row.id, error: result.error ?? 'Nepoznata greška' });
    }
  }

  return { deleteIds, failures };
}

/**
 * POST /sync/push za lokalne PENDING operacije koje su spremne za slanje.
 *
 * Neuspjeh se ne baca kao trajna greška: stavka ostaje u queue-u sa
 * backoff-om (1m/5m/15m/1h/6h), a poslije 5 pokušaja prelazi u FAILED.
 * Ako mreža padne u toku push-a, sve stavke iz batch-a se odlažu i greška se
 * propagira (ekran prikaže „offline“), uz sačuvan `attempts`.
 */
export async function flushQueue(
  db: SqlDb,
): Promise<{ pushed: number; failed: number; retried: number; skipped: number }> {
  const now = new Date();
  const rows = await db.query<QueueRow>(
    `SELECT * FROM sync_queue
     WHERE status = 'PENDING' AND (nextAttemptAt IS NULL OR nextAttemptAt <= ?)
     ORDER BY createdAt ASC LIMIT 50`,
    [now.toISOString()],
  );

  if (rows.length === 0) {
    return { pushed: 0, failed: 0, retried: 0, skipped: 0 };
  }

  let response: PushResponse;
  try {
    response = await apiRequest<PushResponse>('/sync/push', {
      method: 'POST',
      body: { operations: buildOperations(rows) },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Slanje nije uspjelo';
    for (const row of rows) {
      await scheduleRetry(db, row, message);
    }
    throw caught;
  }

  const plan = planResultApplication(rows, response.results);

  for (const id of plan.deleteIds) {
    await db.execute('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  let failed = 0;
  let retried = 0;
  for (const failure of plan.failures) {
    const row = rows.find((candidate) => candidate.id === failure.id);
    if (!row) {
      continue;
    }
    const state = await scheduleRetry(db, row, failure.error);
    if (state.status === 'FAILED') {
      failed += 1;
    } else {
      retried += 1;
    }
  }

  return {
    pushed: plan.deleteIds.length,
    failed,
    retried,
    skipped: rows.length - plan.deleteIds.length - plan.failures.length,
  };
}

/** Upisuje sljedeći pokušaj (ili FAILED) u queue. */
async function scheduleRetry(db: SqlDb, row: QueueRow, error: string): Promise<RetryState> {
  const state = planRetry(row.attempts ?? 0);
  await db.execute(
    `UPDATE sync_queue SET status = ?, attempts = ?, nextAttemptAt = ?, error = ? WHERE id = ?`,
    [state.status, state.attempts, state.nextAttemptAt, error, row.id],
  );
  return state;
}

/** Zbirno stanje queue-a za UI (alarm na 3 dana, FAILED stavke). */
export async function queueSummary(db: SqlDb): Promise<QueueAlarm> {
  const rows = await db.query<{ status: string; createdAt: string; nextAttemptAt: string | null }>(
    'SELECT status, createdAt, nextAttemptAt FROM sync_queue',
  );
  return summarizeQueue(rows);
}

/** Ručno vraća FAILED stavke u PENDING (dugme „Pokušaj ponovo“). */
export async function retryFailed(db: SqlDb): Promise<number> {
  const failed = await db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'FAILED'`,
  );
  await db.execute(
    `UPDATE sync_queue SET status = 'PENDING', attempts = 0, nextAttemptAt = NULL, error = NULL
     WHERE status = 'FAILED'`,
  );
  return Number(failed[0]?.count ?? 0);
}

/** Dodaje lokalnu operaciju u queue (offline-first). */
export async function enqueueOperation(
  db: SqlDb,
  operation: {
    entity: 'customer' | 'invoice';
    op: 'create' | 'update';
    entityId: string;
    payload: unknown;
  },
): Promise<void> {
  await db.execute(
    `INSERT INTO sync_queue (id, entity, op, entityId, payload, createdAt, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      uuidv7(),
      operation.entity,
      operation.op,
      operation.entityId,
      JSON.stringify(operation.payload),
      new Date().toISOString(),
    ],
  );
}

export async function pendingCount(db: SqlDb): Promise<number> {
  const rows = await db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'PENDING'`,
  );
  return Number(rows[0]?.count ?? 0);
}

export type { SyncResultStatus };
