import { z } from 'zod';

/** GET /reports/receivables — aging potraživanja (§6). */
export const receivablesQuerySchema = z.object({
  asOf: z.string().datetime({ offset: true }).optional(),
});
export type ReceivablesQuery = z.infer<typeof receivablesQuerySchema>;

/** GET /reports/monthly — mjesečni izvještaj (§6). */
export const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export const RECEIVABLES_BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'] as const;
export type ReceivablesBucketKey = (typeof RECEIVABLES_BUCKETS)[number];
