import { describe, expect, it } from 'vitest';

import { BUCKET_LABELS, formatDate, formatFening, STATUS_LABELS } from './format';

describe('format — prikaz iznosa i statusa', () => {
  it('formatira fening u KM sa dvije decimale', () => {
    expect(formatFening(0)).toBe('0.00 KM');
    expect(formatFening(123456)).toBe('1234.56 KM');
    expect(formatFening(1755)).toBe('17.55 KM');
  });

  it('formatira datum (bs-BA, zona Sarajevo)', () => {
    expect(formatDate('2026-11-09T12:00:00.000Z')).toContain('2026');
  });

  it('ima labele za statuse i aging buckete', () => {
    expect(STATUS_LABELS['PAID']).toBe('Plaćeno');
    expect(STATUS_LABELS['PENDING_FISCAL']).toBe('Čeka fiskalizaciju');
    expect(BUCKET_LABELS['1-30']).toBe('1–30 dana');
  });
});
