import { describe, expect, it } from 'vitest';

import { FISCAL_RETRY_DELAYS_MINUTES, fiscalRetryDelayMinutes } from './fiscal-backoff';

describe('fiscalRetryDelayMinutes (§7.5)', () => {
  it('prati redoslijed 1m, 5m, 15m, 1h, 6h', () => {
    expect(FISCAL_RETRY_DELAYS_MINUTES).toEqual([1, 5, 15, 60, 360]);
    expect(fiscalRetryDelayMinutes(0)).toBe(1);
    expect(fiscalRetryDelayMinutes(1)).toBe(5);
    expect(fiscalRetryDelayMinutes(2)).toBe(15);
    expect(fiscalRetryDelayMinutes(3)).toBe(60);
    expect(fiscalRetryDelayMinutes(4)).toBe(360);
  });

  it('prestaje sa retryjem nakon 5 pokušaja', () => {
    expect(fiscalRetryDelayMinutes(5)).toBeNull();
    expect(fiscalRetryDelayMinutes(12)).toBeNull();
  });

  it('odbija negativan ili necijeli broj', () => {
    expect(() => fiscalRetryDelayMinutes(-1)).toThrow();
    expect(() => fiscalRetryDelayMinutes(1.5)).toThrow();
  });
});
