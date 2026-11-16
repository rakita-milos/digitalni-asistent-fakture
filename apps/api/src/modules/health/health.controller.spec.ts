import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../redis/redis.service';
import { HealthController } from './health.controller';

function createController(databaseOk = true, redisOk = true) {
  const prisma = {
    $queryRaw: vi.fn(() =>
      databaseOk ? Promise.resolve([{ 1: 1 }]) : Promise.reject(new Error('db down')),
    ),
  } as unknown as PrismaService;
  const redis = {
    ping: vi.fn(() => (redisOk ? Promise.resolve() : Promise.reject(new Error('redis down')))),
  } as unknown as RedisService;
  const response = { status: vi.fn() };
  return { controller: new HealthController(prisma, redis), response };
}

describe('HealthController', () => {
  it('vraća 200 i "ok" kada su baza i Redis dostupni', async () => {
    const { controller, response } = createController();
    const body = await controller.check(response as never);

    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ database: 'ok', redis: 'ok' });
    expect(typeof body.uptime).toBe('number');
    expect(body.timestamp).toMatch(/Z$/);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('vraća 503 kada baza nije dostupna', async () => {
    const { controller, response } = createController(false, true);
    const body = await controller.check(response as never);

    expect(body.status).toBe('error');
    expect(body.checks).toEqual({ database: 'error', redis: 'ok' });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('vraća 503 kada Redis nije dostupan', async () => {
    const { controller, response } = createController(true, false);
    const body = await controller.check(response as never);

    expect(body.status).toBe('error');
    expect(body.checks).toEqual({ database: 'ok', redis: 'error' });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('ponavlja PING jednom dok se Redis još povezuje', async () => {
    const prisma = { $queryRaw: vi.fn(() => Promise.resolve([{ 1: 1 }])) } as unknown as PrismaService;
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new Error('connecting'))
      .mockResolvedValueOnce(undefined);
    const redis = { ping } as unknown as RedisService;
    const response = { status: vi.fn() };

    const controller = new HealthController(prisma, redis);
    const body = await controller.check(response as never);

    expect(body.status).toBe('ok');
    expect(body.checks.redis).toBe('ok');
    expect(ping).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });
});
