import { describe, expect, it } from 'vitest';

import { BULK_LIMIT, canBulkIssue, canBulkRemind } from './invoice-bulk';

describe('W-03 masovne akcije — pravila selekcije', () => {
  it('izdavanje važi samo za DRAFT račun, ne i za PRAČUN', () => {
    expect(canBulkIssue({ status: 'DRAFT', type: 'SALE' })).toBe(true);
    expect(canBulkIssue({ status: 'DRAFT', type: 'ADVANCE' })).toBe(false);
    expect(canBulkIssue({ status: 'ISSUED', type: 'SALE' })).toBe(false);
    expect(canBulkIssue({ status: 'CANCELLED', type: 'SALE' })).toBe(false);
  });

  it('podsjetnik važi za izdate i neplaćene statuse', () => {
    expect(canBulkRemind({ status: 'ISSUED', type: 'SALE' })).toBe(true);
    expect(canBulkRemind({ status: 'SENT', type: 'SALE' })).toBe(true);
    expect(canBulkRemind({ status: 'PARTIALLY_PAID', type: 'SALE' })).toBe(true);
    expect(canBulkRemind({ status: 'OVERDUE', type: 'SALE' })).toBe(true);
    expect(canBulkRemind({ status: 'DRAFT', type: 'SALE' })).toBe(false);
    expect(canBulkRemind({ status: 'PAID', type: 'SALE' })).toBe(false);
    expect(canBulkRemind({ status: 'CANCELLED', type: 'SALE' })).toBe(false);
  });

  it('limit je 50 faktura po akciji', () => {
    expect(BULK_LIMIT).toBe(50);
  });
});
