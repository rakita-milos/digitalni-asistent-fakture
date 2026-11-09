import { z } from 'zod';

import { invoiceStatusSchema, invoiceTypeSchema, paymentMethodSchema } from '../enums';
import { uuidV7Schema } from '../validation';

/**
 * Fakture — §5 (invoices/invoice_lines) i §6 (/invoices).
 * Sprint 2 obuhvata samo DRAFT tok: kreiranje, lista, detalj i izmjena drafta.
 * Numerisanje: draft nosi privremeni `DRAFT-…` broj; pravi broj se dodjeljuje pri izdavanju (Sprint 3).
 */

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  /** Količina × 1000 (3 decimale), npr. 1.5 => 1500. */
  qtyMilli: z.number().int().min(1).max(1_000_000_000),
  unitPriceFening: z.number().int().min(0).max(1_000_000_000_000),
  /** Popust u baznim poenima: 10000 = 100 %. */
  discountBp: z.number().int().min(0).max(10000).default(0),
  /** Porezna stopa u baznim poenima: 1700 = 17 %. */
  taxRateBp: z.number().int().min(0).max(10000),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

export const createInvoiceSchema = z
  .object({
    customerId: uuidV7Schema,
    type: invoiceTypeSchema.default('SALE'),
    issueDate: z.string().datetime({ offset: true }),
    dueDate: z.string().datetime({ offset: true }),
    currency: z.string().trim().length(3).default('BAM'),
    note: z.string().trim().max(2000).optional(),
    paymentMethod: paymentMethodSchema.optional(),
    lines: z.array(invoiceLineInputSchema).min(1).max(100),
  })
  .refine((value) => new Date(value.dueDate).getTime() >= new Date(value.issueDate).getTime(), {
    message: 'Datum dospijeća ne može biti prije datuma izdavanja',
    path: ['dueDate'],
  });
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = z
  .object({
    customerId: uuidV7Schema.optional(),
    issueDate: z.string().datetime({ offset: true }).optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
    currency: z.string().trim().length(3).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    lines: z.array(invoiceLineInputSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Najmanje jedno polje je obavezno',
  });
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/** GET /invoices — filteri iz §6 (status, period) + pretraga po broju. */
export const invoiceListQuerySchema = z.object({
  status: invoiceStatusSchema.optional(),
  customerId: uuidV7Schema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
