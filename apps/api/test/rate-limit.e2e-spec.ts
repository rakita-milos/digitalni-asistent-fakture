import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { env } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';
const LOGIN_LIMIT = 5;

/**
 * S11-1/A6 — rate limiter na stvarnom Redis-u (ne unit mock).
 * Ostali e2e fajlovi imaju `RATE_LIMIT_ENABLED=false` (test/setup.ts); ovdje ga palimo
 * na istom `env` objektu koji guard čita u trenutku zahtjeva.
 */
describe('S11 — rate limiter (stvarni Redis brojači)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  beforeAll(async () => {
    Object.assign(env, { RATE_LIMIT_ENABLED: true });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    redis = new Redis(env.REDIS_URL);
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);

    // Brojači prethodnog testa/pokretanja ne smiju uticati na ovaj.
    const keys = await redis.keys('rate:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  const register = async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Majstor d.o.o.',
          jib: '1234567890123',
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: '+38766123001',
          email: 'vlasnik@example.ba',
        },
        owner: { email: 'vlasnik@example.ba', phone: '+38766123001', password: PASSWORD },
        device: { platform: 'android' },
      });

    expect(response.status).toBe(201);
  };

  it('šesti pokušaj prijave u minuti vraća 429 (i za ispravnu lozinku)', async () => {
    await register();

    for (let attempt = 1; attempt <= LOGIN_LIMIT; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'vlasnik@example.ba', password: 'pogresna123' });

      expect(response.status).toBe(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: 'pogresna123' });

    expect(blocked.status).toBe(429);
    expect(String(blocked.body.message)).toContain('Previše pokušaja');

    // Ispravna lozinka ne prolazi dok je prozor zaključan.
    const blockedValid = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: PASSWORD });

    expect(blockedValid.status).toBe(429);

    const keys = await redis.keys('rate:login:*');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('limit je po ruti — druge rute rade dok je prijava zaključana', async () => {
    await register();

    for (let attempt = 1; attempt <= LOGIN_LIMIT; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'vlasnik@example.ba', password: 'pogresna123' });
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: PASSWORD })
      .expect(429);

    // Drugi bucket (forgot-password) i zdravstvena provjera nisu pogođeni.
    const forgot = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'vlasnik@example.ba' });

    expect(forgot.status).toBe(200);

    const health = await request(app.getHttpServer()).get('/health');
    expect(health.status).toBe(200);
  });
});
