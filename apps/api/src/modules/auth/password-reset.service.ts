import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

/**
 * Reset lozinke (§21.2): token 30 min, jednokratan, hash u bazi/Redis-u.
 *
 * Token se ne čuva u plain tekstu — u Redis-u je samo SHA-256 hash.
 * Novi zahtjev invalidira prethodni token istog korisnika.
 */
@Injectable()
export class PasswordResetService {
  constructor(private readonly redis: RedisService) {}

  private tokenKey(token: string): string {
    return `password-reset:token:${sha256(token)}`;
  }

  private userKey(userId: string): string {
    return `password-reset:user:${userId}`;
  }

  /** Kreira novi jednokratni token i vraća ga (samo ovdje postoji u plain tekstu). */
  async create(userId: string): Promise<{ token: string; expiresInSeconds: number }> {
    const token = randomBytes(32).toString('base64url');
    const ttl = env.PASSWORD_RESET_TTL_SECONDS;

    const previous = await this.redis.get(this.userKey(userId));
    if (previous) {
      await this.redis.del(this.tokenKey(previous));
    }

    await this.redis.setWithTtl(this.tokenKey(token), userId, ttl);
    await this.redis.setWithTtl(this.userKey(userId), token, ttl);

    return { token, expiresInSeconds: ttl };
  }

  /** Atomski troši token; vraća userId ili null ako je istekao/iskorišten/nepostojeći. */
  async consume(token: string): Promise<string | null> {
    const userId = await this.redis.take(this.tokenKey(token));
    if (!userId) {
      return null;
    }
    await this.redis.del(this.userKey(userId));
    return userId;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
