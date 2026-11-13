import { describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';
import type { AnalyticsEvent } from './analytics.types';

interface CapturedLogger {
  logger: { log: (message: string) => void };
}

function capture() {
  const service = new AnalyticsService();
  const spy = vi.spyOn((service as unknown as CapturedLogger).logger, 'log');
  return { service, spy };
}

function payload(spy: ReturnType<typeof capture>['spy']): Record<string, unknown> {
  const line = spy.mock.calls[0]?.[0] ?? '';
  expect(line).toMatch(/^ANALYTICS /);
  return JSON.parse(line.slice('ANALYTICS '.length)) as Record<string, unknown>;
}

describe('AnalyticsService', () => {
  it('loguje registrovan događaj u strukturisanom formatu', () => {
    const { service, spy } = capture();

    service.track('invoice_issued', { companyId: 'company-1', invoiceId: 'invoice-1' });

    const body = payload(spy);
    expect(body.event).toBe('invoice_issued');
    expect(body.companyId).toBe('company-1');
    expect(body.invoiceId).toBe('invoice-1');
    expect(typeof body.at).toBe('string');
  });

  it('prihvata samo dozvoljeni kanal i odbacuje prazna svojstva', () => {
    const { service, spy } = capture();

    service.track('reminder_sent', { companyId: 'c1', channel: 'sms' });

    const body = payload(spy);
    expect(body.channel).toBe('sms');
    expect(Object.keys(body).sort()).toEqual(['at', 'channel', 'companyId', 'event']);
  });

  it('ne propušta PII ni kada se pošalje greškom', () => {
    const { service, spy } = capture();

    service.track('registration', {
      companyId: 'c1',
      email: 'majstor@example.com',
      phone: '+38765000000',
      customerName: 'Petar Petrović',
    } as unknown as { companyId: string });

    const line = spy.mock.calls[0]?.[0] ?? '';
    expect(line).not.toContain('@');
    expect(line).not.toContain('+387');
    expect(line).not.toContain('Petar');
    expect(payload(spy).companyId).toBe('c1');
  });

  it('ignoriše nepoznat događaj (nema loga)', () => {
    const { service, spy } = capture();

    service.track('unknown_event' as AnalyticsEvent);

    expect(spy).not.toHaveBeenCalled();
  });
});
