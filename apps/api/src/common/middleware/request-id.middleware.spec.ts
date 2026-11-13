import { describe, expect, it, vi } from 'vitest';

import { RequestIdMiddleware } from './request-id.middleware';

function run(headers: Record<string, string | string[] | undefined> = {}) {
  const middleware = new RequestIdMiddleware();
  const request = { headers } as never;
  const response = { setHeader: vi.fn() };
  const next = vi.fn();

  middleware.use(request, response as never, next);

  return { headers, response, next };
}

describe('RequestIdMiddleware', () => {
  it('postavlja x-request-id u odgovor i u zahtjev (UUID ako nije poslan)', () => {
    const { headers, response, next } = run();

    expect(response.setHeader).toHaveBeenCalledTimes(1);
    const [name, value] = response.setHeader.mock.calls[0] as [string, string];
    expect(name).toBe('x-request-id');
    expect(value).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-request-id']).toBe(value);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('poštuje dolazni x-request-id i trimuje ga', () => {
    const { headers, response } = run({ 'x-request-id': '  gateway-123  ' });

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'gateway-123');
    expect(headers['x-request-id']).toBe('gateway-123');
  });

  it('generiše novi ID kada je dolazni prazan', () => {
    const { headers, response } = run({ 'x-request-id': '   ' });

    const value = response.setHeader.mock.calls[0]?.[1] as string;
    expect(value).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-request-id']).toBe(value);
  });
});
