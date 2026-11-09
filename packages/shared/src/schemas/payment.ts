import { z } from 'zod';

import { paymentMethodSchema } from '../enums';

/** POST /invoices/:id/payments — naplata (§6, §7.8). */
export const createPaymentSchema = z.object({
  amountFening: z.number().int().min(1).max(1_000_000_000_000),
  method: paymentMethodSchema,
  paidAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
