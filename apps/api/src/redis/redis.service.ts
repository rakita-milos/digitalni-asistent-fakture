import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  /** Atomski INCR + EXPIRE (rate limiting, OTP brojači). */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.multi().incr(key).expire(key, ttlSeconds).exec();
    const value = result?.[0]?.[1];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /** Atomski SET NX + TTL — idempotencija POST zahtjeva (§21). */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Atomski GET + DEL — jednokratni tokeni (reset lozinke). */
  async take(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
