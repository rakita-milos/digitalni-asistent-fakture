import { z } from 'zod';

import { emailSchema, phoneSchema } from '../validation';

/**
 * PATCH /company (owner) — §6. JIB, id i created_at se ne mijenjaju.
 * Nullable polja (logo_url, efd_id) se mogu obrisati slanjem `null`.
 */
export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    logoUrl: z.string().trim().max(2048).nullable().optional(),
    efdId: z.string().trim().max(100).nullable().optional(),
    numberingPrefix: z.string().trim().max(20).optional(),
    numberingYear: z.number().int().min(2020).max(2100).optional(),
    numberingNext: z.number().int().min(1).optional(),
    defaultDueDays: z.number().int().min(0).max(365).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Najmanje jedno polje je obavezno',
  });

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
