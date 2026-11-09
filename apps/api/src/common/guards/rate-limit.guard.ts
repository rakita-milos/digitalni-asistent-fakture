import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';
import type { RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

/**
 * Rate limiting po IP-u — §21.5.
 * Redis je izvor brojača (radi sa više instanci API-ja).
 * Ako Redis padne: u produkciji fail-closed (503), u razvoju fail-open uz log.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!env.RATE_LIMIT_ENABLED) {
      return true;
    }

    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const key = `rate:${options.key}:${ip}`;

    try {
      const count = await this.redis.incrWithTtl(key, options.windowSeconds);
      if (count > options.limit) {
        throw new HttpException(
          { message: ['Previše pokušaja — pokušajte kasnije'] },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Rate limit nedostupan: ${(error as Error).message}`);
      if (env.NODE_ENV === 'production') {
        throw new HttpException(
          { message: ['Servis za ograničavanje nije dostupan'] },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return true;
    }
  }
}
