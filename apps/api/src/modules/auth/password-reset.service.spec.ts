import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RedisService } from '../../redis/redis.service';
import { PasswordResetService } from './password-reset.service';

class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async take(key: string): Promise<string | null> {
    const value = await this.get(key);
    if (value !== null) {
      this.store.delete(key);
    }
    return value;
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}

describe('PasswordResetService (§21.2)', () => {
  let redis: FakeRedis;
  let service: PasswordResetService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    redis = new FakeRedis();
    service = new PasswordResetService(redis as unknown as RedisService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('kreira token koji važi 30 minuta i troši se samo jednom', async () => {
    const created = await service.create('user-1');

    expect(created.token.length).toBeGreaterThanOrEqual(40);
    expect(created.expiresInSeconds).toBe(1800);

    expect(await service.consume(created.token)).toBe('user-1');
    expect(await service.consume(created.token)).toBeNull();
  });

  it('ne čuva token u plain tekstu', async () => {
    const created = await service.create('user-1');

    expect(redis.keys().some((key) => key.includes(created.token))).toBe(false);
    expect(redis.keys().every((key) => key.startsWith('password-reset:'))).toBe(true);
  });

  it('novi zahtjev invalidira prethodni token', async () => {
    const first = await service.create('user-1');
    const second = await service.create('user-1');

    expect(await service.consume(first.token)).toBeNull();
    expect(await service.consume(second.token)).toBe('user-1');
  });

  it('token istekne poslije 30 minuta', async () => {
    const created = await service.create('user-1');

    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(await service.consume(created.token)).toBeNull();
  });

  it('nepoznat token vraća null', async () => {
    expect(await service.consume('nepostojeci-token-0123456789')).toBeNull();
  });
});
