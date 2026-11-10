import { formatDraftNumber } from '@digitalni-asistent/shared';

import type { LocalInvoice } from '../db/repos';

/**
 * Lokalna (offline) draft faktura — M-05 offline.
 *
 * Server ne vidi ovaj zapis dok `flushQueue` ne pošalje operaciju; broj je privremeni
 * `DRAFT-…` (isto kao server-side draft), a pravi broj dolazi pri izdavanju.
 */

/** Kratki privremeni broj iz UUID-a entiteta: `DRAFT-XXXXXXXX`. */
export function formatLocalDraftNumber(entityId: string): string {
  const compact = entityId.replace(/-/g, '').toUpperCase();
  return formatDraftNumber(compact.slice(-8));
}

export interface LocalDraftInput {
  id: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  totalFening: number;
  updatedAt: string;
}

export function buildLocalDraftInvoice(input: LocalDraftInput): LocalInvoice {
  return {
    id: input.id,
    number: formatLocalDraftNumber(input.id),
    status: 'DRAFT',
    customerId: input.customerId,
    customerName: input.customerName,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    totalFening: input.totalFening,
    paidFening: 0,
    updatedAt: input.updatedAt,
  };
}
