import { describe, expect, it } from 'vitest';

import {
  createInvoiceSchema,
  formatDraftNumber,
  formatInvoiceNumber,
  invoiceListQuerySchema,
  updateInvoiceSchema,
} from '..';

const line = {
  description: 'Kabl 3x1.5',
  qtyMilli: 1500,
  unitPriceFening: 1000,
  taxRateBp: 1700,
};

const validInvoice = {
  customerId: '01890a5d-ac96-774b-bcce-b302099a8057',
  issueDate: '2026-11-09T10:00:00.000Z',
  dueDate: '2026-11-24T10:00:00.000Z',
  lines: [line],
};

describe('createInvoiceSchema (§6 POST /invoices)', () => {
  it('prihvata draft sa jednom linijom i default-ima', () => {
    const parsed = createInvoiceSchema.parse(validInvoice);
    expect(parsed.type).toBe('SALE');
    expect(parsed.currency).toBe('BAM');
    expect(parsed.lines[0]?.discountBp).toBe(0);
  });

  it('odbija fakturu bez linija', () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, lines: [] }).success).toBe(false);
  });

  it('odbija dospijeće prije izdavanja', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      dueDate: '2026-11-08T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('odbija količinu 0 i stopu > 10000', () => {
    expect(
      createInvoiceSchema.safeParse({
        ...validInvoice,
        lines: [{ ...line, qtyMilli: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createInvoiceSchema.safeParse({
        ...validInvoice,
        lines: [{ ...line, taxRateBp: 10001 }],
      }).success,
    ).toBe(false);
  });

  it('odbija neispravan UUID kupca', () => {
    expect(
      createInvoiceSchema.safeParse({ ...validInvoice, customerId: 'nije-uuid' }).success,
    ).toBe(false);
  });
});

describe('updateInvoiceSchema', () => {
  it('odbija prazan objekat', () => {
    expect(updateInvoiceSchema.safeParse({}).success).toBe(false);
  });

  it('dozvoljava zamjenu svih linija', () => {
    const parsed = updateInvoiceSchema.parse({ lines: [line, { ...line, description: 'Druga' }] });
    expect(parsed.lines).toHaveLength(2);
  });
});

describe('invoiceListQuerySchema', () => {
  it('koercira paginaciju i prihvata filtere', () => {
    const parsed = invoiceListQuerySchema.parse({ status: 'DRAFT', limit: '10', offset: '0' });
    expect(parsed).toMatchObject({ status: 'DRAFT', limit: 10, offset: 0 });
  });

  it('odbija nepoznat status', () => {
    expect(invoiceListQuerySchema.safeParse({ status: 'NEPOSTOJI' }).success).toBe(false);
  });
});

describe('numeracija (§7.1)', () => {
  it('formatira {year}-{seq:4} sa vodećim nulama', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('2026-0001');
    expect(formatInvoiceNumber(2026, 42)).toBe('2026-0042');
    expect(formatInvoiceNumber(2026, 12345)).toBe('2026-12345');
  });

  it('odbija neispravnu sekvencu i godinu', () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
    expect(() => formatInvoiceNumber(1990, 1)).toThrow();
  });

  it('formatira privremeni broj drafta', () => {
    expect(formatDraftNumber('a1b2c3')).toBe('DRAFT-A1B2C3');
  });
});
