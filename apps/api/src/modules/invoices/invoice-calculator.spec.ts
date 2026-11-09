import { describe, expect, it } from 'vitest';

import {
  calculateInvoiceTotals,
  calculateLine,
  calculateLines,
  divRoundHalfUp,
} from './invoice-calculator';

const line = (overrides: Partial<Parameters<typeof calculateLine>[0]> = {}) => ({
  description: 'Kabl 3x1.5',
  qtyMilli: 1000,
  unitPriceFening: 1000,
  discountBp: 0,
  taxRateBp: 1700,
  ...overrides,
});

describe('divRoundHalfUp (§7.2)', () => {
  it('zaokružuje 0.5 naviše', () => {
    expect(divRoundHalfUp(1n, 2n)).toBe(1n);
    expect(divRoundHalfUp(3n, 2n)).toBe(2n);
  });

  it('zaokružuje ispod 0.5 naniže', () => {
    expect(divRoundHalfUp(2n, 5n)).toBe(0n);
    expect(divRoundHalfUp(2n, 3n)).toBe(1n); // 0.667
  });

  it('vraća tačan cijeli broj bez ostatka', () => {
    expect(divRoundHalfUp(2000n, 1000n)).toBe(2n);
    expect(divRoundHalfUp(1_500_000n, 1000n)).toBe(1500n);
    expect(divRoundHalfUp(1500n, 1000n)).toBe(2n); // 1.5 → half-up
  });

  it('odbija negativne vrijednosti i nulti djelilac', () => {
    expect(() => divRoundHalfUp(-1n, 2n)).toThrow();
    expect(() => divRoundHalfUp(1n, 0n)).toThrow();
  });
});

describe('calculateLine (§7.3)', () => {
  it('obračuna 1.5 × 10,00 KM bez popusta, PDV 17%', () => {
    const result = calculateLine(line({ qtyMilli: 1500, unitPriceFening: 1000 }), 1);
    expect(result.lineSubtotalFening).toBe(1500n); // 15,00 KM
    expect(result.lineTaxFening).toBe(255n); // 2,55 KM
    expect(result.lineTotalFening).toBe(1755n);
  });

  it('primjenjuje popust od 10 % prije poreza', () => {
    const result = calculateLine(line({ unitPriceFening: 1000, discountBp: 1000 }), 1);
    expect(result.lineSubtotalFening).toBe(900n);
    expect(result.lineTaxFening).toBe(153n);
    expect(result.lineTotalFening).toBe(1053n);
  });

  it('zaokružuje porez half-up (333 × 17 % = 56,61 → 57)', () => {
    const result = calculateLine(line({ unitPriceFening: 333 }), 1);
    expect(result.lineTaxFening).toBe(57n);
    expect(result.lineTotalFening).toBe(390n);
  });

  it('zaokružuje 0,5 feninga naviše (50 % poreza na 1 fening)', () => {
    const result = calculateLine(line({ unitPriceFening: 1, taxRateBp: 5000 }), 1);
    expect(result.lineTaxFening).toBe(1n);
    expect(result.lineTotalFening).toBe(2n);
  });

  it('dozvoljava 0 % poreza i 100 % popusta', () => {
    expect(calculateLine(line({ taxRateBp: 0 }), 1).lineTaxFening).toBe(0n);
    const free = calculateLine(line({ discountBp: 10000 }), 1);
    expect(free.lineSubtotalFening).toBe(0n);
    expect(free.lineTotalFening).toBe(0n);
  });

  it('obračunava količinu sa 3 decimale (0,333 × 900)', () => {
    const result = calculateLine(line({ qtyMilli: 333, unitPriceFening: 900 }), 1);
    expect(result.lineSubtotalFening).toBe(300n); // 299,7 → 300
  });
});

describe('calculateLines i totali', () => {
  it('dodjeljuje pozicije redom i sabira totale', () => {
    const lines = calculateLines([
      line({ qtyMilli: 1500, unitPriceFening: 1000 }), // 1500 + 255
      line({ qtyMilli: 2000, unitPriceFening: 500, discountBp: 1000 }), // 900 + 153
    ]);

    expect(lines.map((entry) => entry.position)).toEqual([1, 2]);

    const totals = calculateInvoiceTotals(lines);
    expect(totals.subtotalFening).toBe(2400n);
    expect(totals.taxFening).toBe(408n);
    expect(totals.totalFening).toBe(2808n);
  });

  it('prazna lista daje nule', () => {
    expect(calculateInvoiceTotals([])).toEqual({
      subtotalFening: 0n,
      taxFening: 0n,
      totalFening: 0n,
    });
  });
});
