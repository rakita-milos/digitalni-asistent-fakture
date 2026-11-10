import { describe, expect, it } from 'vitest';

import {
  addDaysInputValue,
  feningToPriceInput,
  parsePercentToBp,
  parsePriceToFening,
  parseQtyToMilli,
  taxRateBpToPercentInput,
  toApiDateTime,
  toDateInputValue,
  todayInputValue,
} from './invoice-form';

describe('invoice-form — parsiranje unosa', () => {
  it('prihvata decimalni zarez i tačku', () => {
    expect(parseQtyToMilli('1,5')).toBe(1500);
    expect(parseQtyToMilli('1.5')).toBe(1500);
    expect(parsePriceToFening('10,25')).toBe(1025);
    expect(parsePercentToBp('17,5')).toBe(1750);
  });

  it('odbija neispravne vrijednosti', () => {
    expect(parseQtyToMilli('0')).toBeNull();
    expect(parseQtyToMilli('')).toBeNull();
    expect(parsePriceToFening('-1')).toBeNull();
    expect(parsePercentToBp('101')).toBeNull();
    expect(parsePercentToBp('abc')).toBeNull();
  });

  it('formatira vrijednosti za unos', () => {
    expect(feningToPriceInput(123456)).toBe('1234.56');
    expect(taxRateBpToPercentInput(1700)).toBe('17');
  });
});

describe('invoice-form — datumi', () => {
  it('konvertuje datume za API i nazad', () => {
    expect(toApiDateTime('2026-11-01')).toBe('2026-11-01T12:00:00.000Z');
    expect(toDateInputValue('2026-11-09T12:00:00.000Z')).toBe('2026-11-09');
    expect(addDaysInputValue('2026-11-01', 15)).toBe('2026-11-16');
    expect(todayInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
