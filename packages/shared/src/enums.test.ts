import { describe, expect, it } from 'vitest';

import {
  INVOICE_STATUSES,
  INVOICE_TYPES,
  PAYMENT_METHODS,
  REMINDER_STATUSES,
  TRANSACTION_TYPES,
  invoiceStatusSchema,
  invoiceTypeSchema,
  paymentMethodSchema,
  reminderStatusSchema,
  transactionTypeSchema,
} from './enums';

describe('enum šeme (MASTER PROMPT §5)', () => {
  it('InvoiceType ima SALE i ADVANCE', () => {
    expect(INVOICE_TYPES).toEqual(['SALE', 'ADVANCE']);
    expect(invoiceTypeSchema.parse('SALE')).toBe('SALE');
    expect(invoiceTypeSchema.safeParse('REFUND').success).toBe(false);
  });

  it('TransactionType ima SALE, REFUND i VOID', () => {
    expect(TRANSACTION_TYPES).toEqual(['SALE', 'REFUND', 'VOID']);
    expect(transactionTypeSchema.parse('VOID')).toBe('VOID');
  });

  it('InvoiceStatus ima tačno 8 statusa iz specifikacije', () => {
    expect(INVOICE_STATUSES).toHaveLength(8);
    expect([...INVOICE_STATUSES]).toEqual([
      'DRAFT',
      'PENDING_FISCAL',
      'ISSUED',
      'SENT',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED',
    ]);
    expect(invoiceStatusSchema.safeParse('draft').success).toBe(false);
  });

  it('PaymentMethod ima 5 načina plaćanja', () => {
    expect(PAYMENT_METHODS).toHaveLength(5);
    expect(paymentMethodSchema.parse('TRANSFER')).toBe('TRANSFER');
  });

  it('ReminderStatus ima 4 statusa', () => {
    expect(REMINDER_STATUSES).toHaveLength(4);
    expect(reminderStatusSchema.parse('SCHEDULED')).toBe('SCHEDULED');
  });
});
