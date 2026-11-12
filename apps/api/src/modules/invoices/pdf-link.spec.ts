import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPdfLinkToken, verifyPdfLinkToken } from './pdf-link';

const INVOICE_ID = '0190f0aa-7c1e-7c3a-8f10-0123456789ab';

describe('PDF link token (javni link iz poruke)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prihvata token dok ne istekne', () => {
    const token = createPdfLinkToken(INVOICE_ID);

    expect(verifyPdfLinkToken(INVOICE_ID, token)).toBe(true);

    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(verifyPdfLinkToken(INVOICE_ID, token)).toBe(true);
  });

  it('odbija token poslije 15 minuta', () => {
    const token = createPdfLinkToken(INVOICE_ID);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    expect(verifyPdfLinkToken(INVOICE_ID, token)).toBe(false);
  });

  it('odbija token vezan za drugu fakturu', () => {
    const token = createPdfLinkToken(INVOICE_ID);
    const otherInvoice = '0190f0aa-7c1e-7c3a-8f10-0123456789cd';

    expect(verifyPdfLinkToken(otherInvoice, token)).toBe(false);
  });

  it('odbija izmijenjeni token i neispravan format', () => {
    const token = createPdfLinkToken(INVOICE_ID);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    expect(verifyPdfLinkToken(INVOICE_ID, tampered)).toBe(false);
    expect(verifyPdfLinkToken(INVOICE_ID, 'nije-token')).toBe(false);
    expect(verifyPdfLinkToken(INVOICE_ID, '')).toBe(false);
    expect(verifyPdfLinkToken(INVOICE_ID, '9999999999999.abc')).toBe(false);
  });
});
