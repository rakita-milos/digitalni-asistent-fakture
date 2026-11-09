import { z } from 'zod';

/**
 * Artikli — §5 (items) i §6 (GET/POST /items).
 * Iznosi su u feningu (integer), stopa u baznim poenima (10000 bp = 100 %).
 */
export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  priceFening: z.number().int().min(0),
  taxRateBp: z.number().int().min(0).max(10000),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;
