import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(url = '/test'): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const setHeader = vi.fn();

  const request = { method: 'GET', url, headers: {} };
  const response = { status, json, setHeader };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, setHeader };
}

describe('AllExceptionsFilter (format greške §6)', () => {
  it('mapira 404 na NOT_FOUND', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Nema fakture', HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ code: 'NOT_FOUND', message: 'Nema fakture' });
  });

  it('mapira 400 na VALIDATION_ERROR i prenosi details', () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(
      new HttpException({ message: ['jib je neispravan'], error: 'Bad Request' }, 400),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Neispravan zahtjev',
      details: ['jib je neispravan'],
    });
  });

  it('5xx ne otkriva internu grešku', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, setHeader } = createHost();

    filter.catch(new Error('tajni stack trace'), host);

    expect(json).toHaveBeenCalledWith({ code: 'INTERNAL_ERROR', message: 'Interna greška' });
    expect(setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
  });
});
