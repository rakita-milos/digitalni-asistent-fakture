import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import type { MonitoringOptions } from './monitoring.options';
import { MONITORING_OPTIONS } from './monitoring.options';

export type MonitoringContext = Record<string, string | number | boolean | undefined>;

/**
 * Monitoring (§21.8): Sentry kada je `SENTRY_DSN` postavljen, inače no-op.
 * Detalji ostaju u logovima; u Sentry idu samo tagovi (request-id, ruta, status) — bez PII.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly enabled: boolean;

  constructor(@Inject(MONITORING_OPTIONS) options: MonitoringOptions) {
    this.enabled = Boolean(options.dsn);

    if (options.dsn) {
      Sentry.init({
        dsn: options.dsn,
        environment: options.environment,
        ...(options.release ? { release: options.release } : {}),
        tracesSampleRate: options.tracesSampleRate,
      });
      this.logger.log(`Monitoring uključen (Sentry, ${options.environment})`);
    } else {
      this.logger.log('Monitoring: SENTRY_DSN nije postavljen — greške idu samo u log');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  captureException(error: Error, context: MonitoringContext = {}): void {
    if (!this.enabled) {
      return;
    }

    Sentry.withScope((scope) => {
      this.applyContext(scope, context);
      Sentry.captureException(error);
    });
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'error',
    context: MonitoringContext = {},
  ): void {
    if (!this.enabled) {
      return;
    }

    Sentry.withScope((scope) => {
      this.applyContext(scope, context);
      Sentry.captureMessage(message, level);
    });
  }

  private applyContext(scope: Sentry.Scope, context: MonitoringContext): void {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        scope.setTag(key, String(value));
      }
    }
  }
}
