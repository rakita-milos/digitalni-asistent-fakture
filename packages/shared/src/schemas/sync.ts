import { z } from 'zod';

import { uuidV7Schema } from '../validation';

/**
 * Offline sync (§4, §6): klijent šalje batch operacija, `entityId` je UUID v7
 * koji generiše klijent i služi kao idempotency ključ.
 */
export const SYNC_ENTITIES = ['customer', 'invoice'] as const;
export const SYNC_OPS = ['create', 'update'] as const;

export const syncOperationSchema = z.object({
  entity: z.enum(SYNC_ENTITIES),
  op: z.enum(SYNC_OPS),
  entityId: uuidV7Schema,
  /** Validira se po entitetu na serveru (createCustomerSchema / updateCustomerSchema / createInvoiceSchema). */
  payload: z.unknown(),
});
export type SyncOperation = z.infer<typeof syncOperationSchema>;

export const syncPushSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export const syncPullQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
});
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;

export type SyncResultStatus = 'applied' | 'duplicate' | 'failed';

export interface SyncOperationResult {
  entity: (typeof SYNC_ENTITIES)[number];
  entityId: string;
  status: SyncResultStatus;
  error?: string;
}
