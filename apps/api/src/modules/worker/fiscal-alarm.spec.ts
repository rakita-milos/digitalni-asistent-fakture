import { describe, expect, it } from 'vitest';

import { FISCAL_ALARM_AFTER_DAYS, fiscalAlarmKey, isFiscalAlarmDue } from './fiscal-alarm';

describe('alarm za PENDING_FISCAL (§7.5)', () => {
  const now = new Date('2026-11-12T10:00:00.000Z');

  it('alarm se diže tek poslije 3 dana', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 86_400_000);

    expect(FISCAL_ALARM_AFTER_DAYS).toBe(3);
    expect(isFiscalAlarmDue(twoDaysAgo, now)).toBe(false);
    expect(isFiscalAlarmDue(fourDaysAgo, now)).toBe(true);
  });

  it('dedupe ključ je vezan za fakturu i UTC dan', () => {
    const id = '0190f0aa-7c1e-7c3a-8f10-0123456789ab';
    const morning = new Date('2026-11-12T08:00:00.000Z');
    const evening = new Date('2026-11-12T20:00:00.000Z');
    const nextDay = new Date('2026-11-13T08:00:00.000Z');

    expect(fiscalAlarmKey(id, morning)).toBe(fiscalAlarmKey(id, evening));
    expect(fiscalAlarmKey(id, evening)).not.toBe(fiscalAlarmKey(id, nextDay));
    expect(fiscalAlarmKey(id, morning)).toContain(id);
  });
});
