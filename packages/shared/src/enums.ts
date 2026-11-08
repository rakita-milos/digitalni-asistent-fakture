import { z } from 'zod';

/**
 * Enum vrijednosti iz MASTER PROMPT §5.
 * Ovo je jedini izvor istine na TS strani; Prisma šema mora ostati usklađena.
 * Svaka izmjena ovdje zahtijeva i migraciju u `apps/api/prisma/schema.prisma`.
 */

// ── InvoiceType ──────────────────────────────────────────────
export const INVOICE_TYPES = ['SALE', 'ADVANCE'] as const;
export const invoiceTypeSchema = z.enum(INVOICE_TYPES);
export type InvoiceType = z.infer<typeof invoiceTypeSchema>;

// ── TransactionType ──────────────────────────────────────────
/**
 * Rezervisano za Sprint 5 (VOID / REFUND zapisi).
 * Odluka za Sprint 0: enum postoji u šemi, ali `invoices` NEMA kolonu
 * `transaction_type` — kolona se uvodi zajedno sa refund/void tokom.
 */
export const TRANSACTION_TYPES = ['SALE', 'REFUND', 'VOID'] as const;
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

// ── InvoiceStatus ────────────────────────────────────────────
export const INVOICE_STATUSES = [
  'DRAFT',
  'PENDING_FISCAL',
  'ISSUED',
  'SENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

// ── PaymentMethod ────────────────────────────────────────────
export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'VOUCHER', 'OTHER'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// ── ReminderStatus ───────────────────────────────────────────
export const REMINDER_STATUSES = ['SCHEDULED', 'SENT', 'FAILED', 'CANCELLED'] as const;
export const reminderStatusSchema = z.enum(REMINDER_STATUSES);
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
