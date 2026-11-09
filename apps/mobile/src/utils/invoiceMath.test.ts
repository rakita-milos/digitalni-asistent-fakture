import {
  addDaysInput,
  calculatePreviewLine,
  calculatePreviewTotals,
  isValidDateInput,
  parsePercentBp,
  parsePriceFening,
  parseQtyMilli,
  toApiDateTime,
} from './invoiceMath';

describe('invoiceMath — preview obračun (§7.2/§7.3)', () => {
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

    // net = 1500 - 150 = 1350; PDV = 229.5 → 230 (half-up)
    expect(line).toEqual({ subtotalFening: 1350, taxFening: 230, totalFening: 1580 });
  });

  it('sabira više stavki u ukupne iznose', () => {
    const totals = calculatePreviewTotals([
      { qtyMilli: 1000, unitPriceFening: 1000, discountBp: 0, taxRateBp: 1700 },
      { qtyMilli: 2000, unitPriceFening: 500, discountBp: 0, taxRateBp: 0 },
    ]);

    expect(totals).toEqual({ subtotalFening: 2000, taxFening: 170, totalFening: 2170 });
  });
});

describe('invoiceMath — parsiranje unosa', () => {
  it('prihvata decimalni zarez i tačku', () => {
    expect(parseQtyMilli('1,5')).toBe(1500);
    expect(parseQtyMilli('1.5')).toBe(1500);
    expect(parsePriceFening('10,25')).toBe(1025);
    expect(parsePercentBp('17,5')).toBe(1750);
  });

  it('odbija neispravne vrijednosti', () => {
    expect(parseQtyMilli('0')).toBeNull();
    expect(parseQtyMilli('')).toBeNull();
    expect(parsePriceFening('-1')).toBeNull();
    expect(parsePercentBp('101')).toBeNull();
    expect(parsePercentBp('abc')).toBeNull();
  });
});

describe('invoiceMath — datumi', () => {
  it('validira i konvertuje datume', () => {
    expect(isValidDateInput('2026-11-01')).toBe(true);
    expect(isValidDateInput('2026-13-01')).toBe(false);
    expect(isValidDateInput('01.11.2026')).toBe(false);
    expect(toApiDateTime('2026-11-01')).toBe('2026-11-01T12:00:00.000Z');
    expect(addDaysInput('2026-11-01', 15)).toBe('2026-11-16');
  });
});
