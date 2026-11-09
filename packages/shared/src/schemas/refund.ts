import { z } from 'zod';

/**
 * POST /invoices/:id/refund — refundacija (§7.7).
 * Novi zapis tipa REFUND sa referencom na original; iznos ≤ naplaćeno.
 */
export const refundInvoiceSchema = z.object({
  amountFening: z.number().int().min(1).max(1_000_000_000_000),
  note: z.string().trim().max(500).optional(),
});
export type RefundInvoiceInput = z.infer<typeof refundInvoiceSchema>;
