import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

/** Ograničenje broja zahtjeva — §21.5 (login 5/min, OTP 3/5min, register 3/h…). */
export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);
