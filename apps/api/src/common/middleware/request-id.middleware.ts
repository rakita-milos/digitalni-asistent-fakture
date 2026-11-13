import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Korelacijski ID (Pre-Deployment Checklist B3) — svaki odgovor nosi `x-request-id`,
 * a globalni filter ga koristi u logu i Sentry kontekstu. Dolazni ID se poštuje
 * (npr. od gateway-a), inače se generiše UUID v4.
 *
 * Napomena: request se ne mijenja (headers su isti objekat) pa filter vidi isti ID.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
