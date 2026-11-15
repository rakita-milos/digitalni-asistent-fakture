import { z } from 'zod';

/**
 * Artikli — §5 (items) i §6 (GET/POST /items).
 * Iznosi su u feningu (integer), stopa u baznim poenima (10000 bp = 100 %).
 */
const itemFields = {
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  priceFening: z.number().int().min(0),
  taxRateBp: z.number().int().min(0).max(10000),
};

export const createItemSchema = z.object(itemFields);
export type CreateItemInput = z.infer<typeof createItemSchema>;

/**
 * PATCH /items/:id — djelimična izmjena.
 * Meko brisanje ide kroz `archivedAt` (null = vraćanje iz arhive), jer §6 nema DELETE rutu
 * (isti obrazac kao `PATCH /customers/:id`).
 */
export const updateItemSchema = z
  .object({
    ...itemFields,
    name: itemFields.name.optional(),
    unit: itemFields.unit.optional(),
    priceFening: itemFields.priceFening.optional(),
    taxRateBp: itemFields.taxRateBp.optional(),
    archivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Najmanje jedno polje je obavezno',
  });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
