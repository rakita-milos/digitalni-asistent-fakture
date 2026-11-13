import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { ApiError, ErrorCode } from '@digitalni-asistent/shared';
import { ERROR_CODES } from '@digitalni-asistent/shared';
import type { Request, Response } from 'express';

import type { MonitoringService } from '../monitoring/monitoring.service';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
  [HttpStatus.BAD_GATEWAY]: ERROR_CODES.BAD_GATEWAY,
};

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Neispravan zahtjev',
  [HttpStatus.UNAUTHORIZED]: 'Niste prijavljeni',
  [HttpStatus.FORBIDDEN]: 'Nemate dozvolu',
  [HttpStatus.NOT_FOUND]: 'Nije pronađeno',
  [HttpStatus.CONFLICT]: 'Konflikt',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Previše pokušaja',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Servis privremeno nedostupan',
  [HttpStatus.BAD_GATEWAY]: 'Fiskalizacija nije uspjela',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Interna greška',
};

/**
 * Globalni filter grešaka — MASTER PROMPT §6 format:
 * `{ code, message, details? }`, bez stack trace-a u odgovoru,
 * sa korelacijskim ID-jem (Pre-Deployment Checklist §6).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly monitoring?: MonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = this.resolveRequestId(request);

    const body: ApiError = {
      code: STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL_ERROR,
      message: this.resolveMessage(exception, status),
    };

    const details = this.resolveDetails(exception);
    if (details) {
      body.details = details;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.url} [${requestId}]`, stack);
      this.monitoring?.captureException(
        exception instanceof Error ? exception : new Error(String(exception)),
        {
          requestId,
          method: request.method,
          path: request.url,
          status,
        },
      );
    }

    response.setHeader('x-request-id', requestId);
    response.status(status).json(body);
  }

  private resolveRequestId(request: Request): string {
    const header = request.headers['x-request-id'];
    if (typeof header === 'string' && header.length > 0) {
      return header;
    }
    return randomUUID();
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string' && payload.length > 0) {
        return payload;
      }
      if (typeof payload === 'object' && payload !== null) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) {
          return message;
        }
      }
    }
    // 5xx nikad ne otkriva detalje interne greške.
    return DEFAULT_MESSAGES[status] ?? 'Interna greška';
  }

  private resolveDetails(exception: unknown): unknown[] | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }
    const payload = exception.getResponse();
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }
    const details = (payload as { details?: unknown }).details;
    if (Array.isArray(details) && details.length > 0) {
      return details;
    }
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message) && message.length > 0) {
      return message;
    }
    return undefined;
  }
}
