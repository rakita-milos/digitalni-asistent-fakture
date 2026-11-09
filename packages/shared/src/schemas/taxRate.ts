import { z } from 'zod';

/**
 * Porezi — §5 (tax_rates) i §6 (GET /tax-rates).
 * POST /tax-rates nije u §6: dodato u Sprint 1 na kickoff-u, jer setup korak „porezi“
 * (M-02) mora negdje da upiše stope, a GET sam ne može nastati.
 */
export const createTaxRateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  rateBp: z.number().int().min(0).max(10000),
  sufCode: z.string().trim().min(1).max(20),
  active: z.boolean().default(true),
});
export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
