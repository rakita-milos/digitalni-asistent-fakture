import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../config/env';
import type { RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';

const mutableEnv = env as unknown as { RATE_LIMIT_ENABLED: boolean; NODE_ENV: string };
const original = {
  RATE_LIMIT_ENABLED: mutableEnv.RATE_LIMIT_ENABLED,
  NODE_ENV: mutableEnv.NODE_ENV,
};

function context(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip: '203.0.113.7', socket: {} }),
    }),
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
}

function build(
  options: RateLimitOptions | undefined,
  incr: (key: string, ttl: number) => Promise<number>,
) {
  const reflector = { get: () => options } as unknown as Reflector;
  const redis = { incrWithTtl: vi.fn(incr) } as never;
  return { guard: new RateLimitGuard(reflector, redis), redis };
}

afterEach(() => {
  mutableEnv.RATE_LIMIT_ENABLED = original.RATE_LIMIT_ENABLED;
  mutableEnv.NODE_ENV = original.NODE_ENV;
});

describe('RateLimitGuard', () => {
  it('propušta sve kada je rate limiting isključen', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = false;
    const { guard, redis } = build(undefined, () => Promise.resolve(1));

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(
      (redis as unknown as { incrWithTtl: { mock: { calls: unknown[][] } } }).incrWithTtl.mock
        .calls,
    ).toHaveLength(0);
  });

  it('propušta rutu bez @RateLimit metapodatka', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = true;
    const { guard } = build(undefined, () => Promise.resolve(1));

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('propušta zahtjev ispod limita i broji po IP-u', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = true;
    const { guard, redis } = build({ key: 'invoice-issue', limit: 30, windowSeconds: 60 }, () =>
      Promise.resolve(1),
    );

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(
      (redis as unknown as { incrWithTtl: { mock: { calls: unknown[][] } } }).incrWithTtl.mock
        .calls[0],
    ).toEqual(['rate:invoice-issue:203.0.113.7', 60]);
  });

  it('vraća 429 kada je limit prekoračen', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = true;
    const { guard } = build({ key: 'login', limit: 5, windowSeconds: 60 }, () =>
      Promise.resolve(6),
    );

    await expect(guard.canActivate(context())).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('u produkciji je fail-closed (503) kada Redis padne', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = true;
    mutableEnv.NODE_ENV = 'production';
    const { guard } = build({ key: 'login', limit: 5, windowSeconds: 60 }, () =>
      Promise.reject(new Error('redis down')),
    );

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(HttpException);
    await expect(guard.canActivate(context())).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('u razvoju je fail-open kada Redis padne', async () => {
    mutableEnv.RATE_LIMIT_ENABLED = true;
    mutableEnv.NODE_ENV = 'development';
    const { guard } = build({ key: 'login', limit: 5, windowSeconds: 60 }, () =>
      Promise.reject(new Error('redis down')),
    );

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
