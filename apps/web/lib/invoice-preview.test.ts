import { describe, expect, it } from 'vitest';

import { calculatePreviewLine, calculatePreviewTotals } from './invoice-preview';

describe('invoice-preview — obračun kao API (§7.2/§7.3)', () => {
  it('računa osnovicu, PDV i ukupno (half-up)', () => {
    const line = calculatePreviewLine({
      qtyMilli: 1500,
      unitPriceFening: 1000,
      discountBp: 0,
      taxRateBp: 1700,
    });

    expect(line).toEqual({ subtotalFening: 1500, taxFening: 255, totalFening: 1755 });
  });

  it('primjenjuje popust prije PDV-a', () => {
    const line = calculatePreviewLine({
      qtyMilli: 1500,
      unitPriceFening: 1000,
      discountBp: 1000,
      taxRateBp: 1700,
    });

    expect(line).toEqual({ subtotalFening: 1350, taxFening: 230, totalFening: 1580 });
  });

  it('sabira više stavki', () => {
    const totals = calculatePreviewTotals([
      { qtyMilli: 1000, unitPriceFening: 1000, discountBp: 0, taxRateBp: 1700 },
      { qtyMilli: 2000, unitPriceFening: 500, discountBp: 0, taxRateBp: 0 },
    ]);

    expect(totals).toEqual({ subtotalFening: 2000, taxFening: 170, totalFening: 2170 });
  });
});
