import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
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

describe('POST /company/setup-complete (S11-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const registerOwner = async (): Promise<AuthSession> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Setup Firma d.o.o.',
          jib: '1112223334445',
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: '+38766123001',
          email: 'vlasnik@setup.ba',
        },
        owner: { email: 'vlasnik@setup.ba', phone: '+38766123001', password: PASSWORD },
        device: { platform: 'android', appVersion: '0.1.0' },
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

  it('označi setup kao završen i vrati vrijeme (idempotentno)', async () => {
    const session = await registerOwner();

    const first = await request(app.getHttpServer())
      .post('/company/setup-complete')
      .set(authHeader(session.accessToken));

    expect(first.status).toBe(200);
    expect(first.body.alreadyCompleted).toBe(false);
    expect(typeof first.body.setupCompletedAt).toBe('string');

    const company = await request(app.getHttpServer())
      .get('/company')
      .set(authHeader(session.accessToken));
    expect(company.status).toBe(200);
    expect(company.body.setupCompletedAt).toBe(first.body.setupCompletedAt);

    const second = await request(app.getHttpServer())
      .post('/company/setup-complete')
      .set(authHeader(session.accessToken));

    expect(second.status).toBe(200);
    expect(second.body.alreadyCompleted).toBe(true);
    expect(second.body.setupCompletedAt).toBe(first.body.setupCompletedAt);
  });

  it('vraća 403 za radnika (samo vlasnik završava setup)', async () => {
    const session = await registerOwner();
    const worker = await prisma.user.create({
      data: {
        companyId: session.company.id,
        email: 'radnik@setup.ba',
        phone: '+38766123002',
        passwordHash: await hash(PASSWORD),
        role: 'worker',
        status: 'active',
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: worker.email, password: PASSWORD });
    expect(login.status).toBe(200);

    const response = await request(app.getHttpServer())
      .post('/company/setup-complete')
      .set(authHeader((login.body as AuthSession).accessToken));

    expect(response.status).toBe(403);
  });

  it('vraća 401 bez tokena', async () => {
    const response = await request(app.getHttpServer()).post('/company/setup-complete');
    expect(response.status).toBe(401);
  });
});
