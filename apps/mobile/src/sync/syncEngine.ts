import type {
  SyncOperation,
  SyncOperationResult,
  SyncResultStatus,
} from '@digitalni-asistent/shared';

import { apiRequest } from '../api/client';
import type { SqlDb } from '../db/localDb';
import { upsertCustomers, upsertInvoices } from '../db/repos';
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
}

export async function getMeta(db: SqlDb, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: SqlDb, key: string, value: string): Promise<void> {
  await db.execute('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}

/** GET /sync/pull + upis u lokalnu bazu. */
export async function pullAndMerge(
  db: SqlDb,
): Promise<{ customers: number; invoices: number }> {
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

/** POST /sync/push za sve lokalne PENDING operacije. */
export async function flushQueue(
  db: SqlDb,
): Promise<{ pushed: number; failed: number; skipped: number }> {
  const rows = await db.query<QueueRow>(
    `SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY createdAt ASC LIMIT 50`,
  );

  if (rows.length === 0) {
    return { pushed: 0, failed: 0, skipped: 0 };
  }

  const response = await apiRequest<PushResponse>('/sync/push', {
    method: 'POST',
    body: { operations: buildOperations(rows) },
  });

  const plan = planResultApplication(rows, response.results);

  for (const id of plan.deleteIds) {
    await db.execute('DELETE FROM sync_queue WHERE id = ?', [id]);
  }
  for (const failure of plan.failures) {
    await db.execute(`UPDATE sync_queue SET status = 'FAILED', error = ? WHERE id = ?`, [
      failure.error,
      failure.id,
    ]);
  }

  return {
    pushed: plan.deleteIds.length,
    failed: plan.failures.length,
    skipped: rows.length - plan.deleteIds.length - plan.failures.length,
  };
}

/** Dodaje lokalnu operaciju u queue (offline-first). */
export async function enqueueOperation(
  db: SqlDb,
  operation: { entity: 'customer' | 'invoice'; op: 'create' | 'update'; entityId: string; payload: unknown },
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
