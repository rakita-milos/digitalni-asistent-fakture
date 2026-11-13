import { Injectable, Logger } from '@nestjs/common';

import { ANALYTICS_EVENTS } from './analytics.types';
import type { AnalyticsEvent, AnalyticsProps } from './analytics.types';

/** Dozvoljeni ključevi svojstava — runtime allowlist, da PII ne može „procuriti“ ni greškom. */
const ALLOWED_PROP_KEYS = ['companyId', 'invoiceId', 'channel'] as const;

/**
 * Analitika (S11-7): jedan strukturisan log red po događaju, prefiks `ANALYTICS`.
 *
 * Odluka za MVP: bez PostHog-a i bez nove tabele — događaji idu u log
 * (i dalje ih skuplja Sentry/log platforma), a poslovni izvještaji se rade
 * iz `audit_log` preko `scripts/platform-metrics.mjs`. Tako nema PII,
 * nema novih migracija i nema raskoraka sa audit tragom.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
    if (!ANALYTICS_EVENTS.includes(event)) {
      return;
    }

    const payload: Record<string, string> = {
      event,
      at: new Date().toISOString(),
    };

    for (const key of ALLOWED_PROP_KEYS) {
      const value = props[key];
      if (typeof value === 'string' && value.length > 0) {
        payload[key] = value;
      }
    }

    this.logger.log(`ANALYTICS ${JSON.stringify(payload)}`);
  }
}
