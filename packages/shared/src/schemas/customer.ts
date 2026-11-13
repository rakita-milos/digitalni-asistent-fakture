import { z } from 'zod';

import { emailSchema, jibSchema, phoneSchema } from '../validation';

/** Kupci — §5 (customers) i §6 (GET/POST /customers, GET/PATCH /customers/:id). */
const customerFields = {
  name: z.string().trim().min(1).max(200),
  jib: jibSchema.optional(),
  vatId: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  note: z.string().trim().max(2000).optional(),
  /// §7.9: kupac je odjavio automatske podsjetnike.
  reminderOptOut: z.boolean().optional(),
};

export const createCustomerSchema = z.object(customerFields);
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * PATCH /customers/:id — djelimična izmjena.
 * Meko brisanje ide kroz `archivedAt` (null = vraćanje iz arhive), jer §6 nema DELETE rutu.
 */
export const updateCustomerSchema = z
  .object({
    ...customerFields,
    name: customerFields.name.optional(),
    archivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Najmanje jedno polje je obavezno',
  });
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
