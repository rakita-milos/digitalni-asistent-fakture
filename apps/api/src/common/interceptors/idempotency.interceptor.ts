import { ConflictException, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, mergeMap, throwError } from 'rxjs';

import { RedisService } from '../../redis/redis.service';

/** Koliko dugo pamtimo odgovor za isti `Idempotency-Key` (24 h). */
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;

interface IdempotentRequest extends Request {
  user?: { companyId?: string };
}

interface CachedResponse {
  state: 'pending' | 'done';
  body?: unknown;
}

/**
 * `Idempotency-Key` za POST zahtjeve (§6, §21) — spriječava duple fakture/naplate
 * kad mreža padne poslije zahtjeva ili korisnik dvaput pošalje formu.
 *
 * - prvi zahtjev sa ključem: SET NX; odgovor se pamti 24 h
 * - ponovljeni zahtjev: vraća se keširan odgovor (isti id, bez novog zapisa)
 * - zahtjev dok je prvi još u toku: 409
 * - bez headera: ponašanje kao do sada
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<IdempotentRequest>();
    const rawKey = request.header(IDEMPOTENCY_HEADER);

    if (!rawKey) {
      return next.handle();
    }

    const idempotencyKey = rawKey.trim();

    if (idempotencyKey.length === 0 || idempotencyKey.length > MAX_KEY_LENGTH) {
      return next.handle();
    }

    const companyId = request.user?.companyId ?? 'anonymous';
    const redisKey = `idempotency:${companyId}:${request.method}:${request.originalUrl}:${idempotencyKey}`;

    // Ako Redis nije dostupan, ne blokiraj poslovan tok — idempotencija je zaštita, ne uslov.
    let claimed = false;

    try {
      claimed = await this.redis.setIfAbsent(
        redisKey,
        JSON.stringify({ state: 'pending' } satisfies CachedResponse),
        IDEMPOTENCY_TTL_SECONDS,
      );
    } catch {
      return next.handle();
    }

    if (!claimed) {
      return this.replay(redisKey, next);
    }

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const cached: CachedResponse = { state: 'done', body };

        try {
          await this.redis.setWithTtl(
            redisKey,
            JSON.stringify(cached),
            IDEMPOTENCY_TTL_SECONDS,
          );
        } catch {
          // Bez upisa u Redis odgovor i dalje ide klijentu; ponovni zahtjev neće biti deduplikovan.
        }

        return body;
      }),
      catchError((error: unknown) => {
        // Neuspješan zahtjev ne smije zauzeti ključ — dozvoli retry sa istim ključem.
        void this.redis.del(redisKey).catch(() => undefined);
        return throwError(() => error);
      }),
    );
  }

  private async replay(redisKey: string, next: CallHandler): Promise<Observable<unknown>> {
    const stored = await this.redis.get(redisKey).catch(() => null);

    if (!stored) {
      // Ključ je u međuvremenu istekao — pusti zahtjev dalje.
      return next.handle();
    }

    let cached: CachedResponse;

    try {
      cached = JSON.parse(stored) as CachedResponse;
    } catch {
      return next.handle();
    }

    if (cached.state === 'pending') {
      throw new ConflictException({
        message: [' Zahtjev sa istim Idempotency-Key je već u toku'],
      });
    }

    return new Observable<unknown>((subscriber) => {
      subscriber.next(cached.body);
      subscriber.complete();
    });
  }
}
