import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 9 — odjava (POST /auth/logout, §10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const register = async (): Promise<AuthSession> => {
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
        device: { platform: 'web' },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
  });

  it('odjava opoziva refresh token i sesija više ne može da se rotira', async () => {
    const session = await register();

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(session.accessToken));
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ loggedOut: true });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    // Nova prijava poslije odjave i dalje radi.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('odjava je idempotentna i traži access token', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(session.accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(session.accessToken))
      .expect(200);

    await request(app.getHttpServer()).post('/auth/logout').expect(401);
  });
});
