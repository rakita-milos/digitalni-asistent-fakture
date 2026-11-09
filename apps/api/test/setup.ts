/**
 * Test okruženje — postavlja env prije nego što se `config/env.ts` parsira.
 * DATABASE_URL/REDIS_URL u CI-ju dolaze iz service kontejnera; lokalno iz docker-compose.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://digitalni:digitalni@localhost:5432/digitalni_asistent?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789';
// Rate limiting se ne testira kroz e2e (zahtijeva Redis brojače i IP kontrolu).
process.env.RATE_LIMIT_ENABLED ??= 'false';
process.env.SMS_PROVIDER ??= 'log';
