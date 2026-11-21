import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../config/env';
import { SmsService } from './sms.service';

const originalEnv = { ...env };

function mockFetch(response: { ok: boolean; status: number } = { ok: true, status: 200 }) {
  const fn = vi.fn(async () => response as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('SmsService (T12-6)', () => {
  let service: SmsService;

  beforeEach(() => {
    service = new SmsService();
    Object.assign(env, {
      FEATURE_SMS_ENABLED: true,
      SMS_PROVIDER: 'log',
      NODE_ENV: 'test',
      SMS_HTTP_URL: undefined,
      SMS_HTTP_TOKEN: undefined,
      SMS_API_KEY: undefined,
      SMS_SENDER_ID: undefined,
    });
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
    vi.restoreAllMocks();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('log režim pamti poruku i ne zove mrežu', async () => {
    const fetchMock = mockFetch();

    await service.send('+38766123001', 'Test poruka');

    expect(service.lastMessage).toEqual({ phone: '+38766123001', text: 'Test poruka' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prazan SMS_PROVIDER se tretira kao log (starije konfiguracije)', async () => {
    Object.assign(env, { SMS_PROVIDER: '' });
    const fetchMock = mockFetch();

    await service.send('+38766123001', 'Test');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.lastMessage).toEqual({ phone: '+38766123001', text: 'Test' });
  });

  it('u produkciji log provajder pada (da ne bude tiho ne-slanje)', async () => {
    Object.assign(env, { NODE_ENV: 'production' });
    mockFetch();

    await expect(service.send('+38766123001', 'Test')).rejects.toThrow(
      /SMS provajder nije konfigurisan/,
    );
  });

  it('http provajder šalje JSON sa tokenom i sender ID-om', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'http',
      SMS_HTTP_URL: 'https://sms.example.test/send',
      SMS_HTTP_TOKEN: 'token-123',
      SMS_SENDER_ID: 'DA',
    });
    const fetchMock = mockFetch();

    await service.send('+38766123001', 'Faktura 2026-0001');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sms.example.test/send');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-123');
    expect(JSON.parse(String(init.body))).toEqual({
      to: '+38766123001',
      message: 'Faktura 2026-0001',
      sender: 'DA',
    });
  });

  it('http provajder prihvata i SMS_API_KEY kao token', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'http',
      SMS_HTTP_URL: 'https://sms.example.test/send',
      SMS_API_KEY: 'legacy-key',
    });
    const fetchMock = mockFetch();

    await service.send('+38766123001', 'Test');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer legacy-key');
  });

  it('http greška provajdera se prijavljuje bez sadržaja odgovora', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'http',
      SMS_HTTP_URL: 'https://sms.example.test/send',
    });
    mockFetch({ ok: false, status: 502 });

    await expect(service.send('+38766123001', 'Test')).rejects.toThrow('SMS provajder je vratio 502');
  });

  it('bez SMS_HTTP_URL baca 503', async () => {
    Object.assign(env, { SMS_PROVIDER: 'http' });

    await expect(service.send('+38766123001', 'Test')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('nepoznat provajder baca 503', async () => {
    Object.assign(env, { SMS_PROVIDER: 'twilio' });

    await expect(service.send('+38766123001', 'Test')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('isključen feature flag blokira slanje', async () => {
    Object.assign(env, { FEATURE_SMS_ENABLED: false });
    mockFetch();

    await expect(service.send('+38766123001', 'Test')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
