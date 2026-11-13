import { env } from '../../config/env';

export const MONITORING_OPTIONS = Symbol('MONITORING_OPTIONS');

export interface MonitoringOptions {
  dsn?: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
}

/** Sentry je uključen samo kada je DSN postavljen; bez DSN-a monitoring je no-op. */
export function monitoringOptionsFromEnv(): MonitoringOptions {
  return {
    dsn: env.SENTRY_DSN?.trim() || undefined,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV,
    release: env.APP_RELEASE?.trim() || undefined,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  };
}
