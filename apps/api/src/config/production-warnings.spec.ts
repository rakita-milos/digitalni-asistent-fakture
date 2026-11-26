import { describe, expect, it } from 'vitest';

import { collectProductionWarnings, type ProductionConfigSnapshot } from './production-warnings';

const base: ProductionConfigSnapshot = {
  NODE_ENV: 'production',
  ESIR_MODE: 'esir',
  SMS_PROVIDER: 'http',
  PUBLIC_API_URL: 'https://api.digitalni-asistent.ba',
  WEB_APP_URL: 'https://digitalni-asistent.ba',
  SENTRY_DSN: 'https://key@sentry.io/1',
};

describe('collectProductionWarnings', () => {
  it('u razvoju i testu ne vraća upozorenja', () => {
    expect(collectProductionWarnings({ ...base, NODE_ENV: 'development' })).toEqual([]);
    expect(collectProductionWarnings({ ...base, NODE_ENV: 'test' })).toEqual([]);
  });

  it('u produkciji prijavi mock fiskalizaciju, log SMS, localhost i Sentry', () => {
    const warnings = collectProductionWarnings({
      ...base,
      ESIR_MODE: 'mock',
      SMS_PROVIDER: 'log',
      PUBLIC_API_URL: 'http://localhost:3001',
      WEB_APP_URL: 'http://127.0.0.1:3000',
      SENTRY_DSN: undefined,
    });

    expect(warnings).toHaveLength(4);
    expect(warnings.join(' ')).toContain('ESIR_MODE=mock');
    expect(warnings.join(' ')).toContain('SMS_PROVIDER=log');
    expect(warnings.join(' ')).toContain('localhost');
    expect(warnings.join(' ')).toContain('SENTRY_DSN');
  });

  it('ispravna produkcijska konfiguracija nema upozorenja', () => {
    expect(collectProductionWarnings(base)).toEqual([]);
  });

  it('neispravan URL tretira kao localhost (upozorenje)', () => {
    expect(collectProductionWarnings({ ...base, PUBLIC_API_URL: 'nije-url' })).toHaveLength(1);
  });
});
