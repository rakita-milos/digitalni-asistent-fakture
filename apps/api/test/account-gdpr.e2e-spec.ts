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

describe('Sprint 9 — GDPR izvoz i brisanje naloga (§10, §21.12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const registerCompany = async (options: {
    jib: string;
    email: string;
    phone: string;
  }): Promise<AuthSession> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Majstor d.o.o.',
          jib: options.jib,
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: options.phone,
          email: options.email,
        },
        owner: { email: options.email, phone: options.phone, password: PASSWORD },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  };

  const createCustomer = async (token: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({
        name: 'Petar Petrović',
        email: 'kupac@example.ba',
        phone: '+38766123002',
        note: 'Kontakt za dostavu',
      });

    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const setupCompany = async (
    company: { jib: string; email: string; phone: string } = {
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    },
  ): Promise<{ session: AuthSession; customerId: string; invoiceId: string }> => {
    const session = await registerCompany(company);
    const customerId = await createCustomer(session.accessToken);

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(session.accessToken))
      .send({
        customerId,
        issueDate: '2026-11-09T10:00:00.000Z',
        dueDate: '2026-11-24T10:00:00.000Z',
        lines: [
          { description: 'Kabl 3x1.5', qtyMilli: 1500, unitPriceFening: 1000, taxRateBp: 1700 },
        ],
      });
    expect(invoice.status).toBe(201);

    const issued = await request(app.getHttpServer())
      .post(`/invoices/${invoice.body.id}/issue`)
      .set(authHeader(session.accessToken));
    expect(issued.status).toBe(201);

    return {
      session,
      customerId,
      invoiceId: invoice.body.id as string,
    };
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

  it('izvoz vraća sve podatke firme bez hash-eva i tajni', async () => {
    const { session, invoiceId } = await setupCompany();

    const response = await request(app.getHttpServer())
      .get('/account/export')
      .set(authHeader(session.accessToken));

    expect(response.status).toBe(200);

    const body = response.body as {
      company: { jib: string };
      users: Array<Record<string, unknown>>;
      customers: Array<{ email: string }>;
      invoices: Array<{ id: string; lines: unknown[]; payments: unknown[] }>;
      fiscalRecords: unknown[];
      devices: Array<Record<string, unknown>>;
    };

    expect(body.company.jib).toBe('1234567890123');
    expect(body.users).toHaveLength(1);
    expect(body.users[0]?.passwordHash).toBeUndefined();
    expect(body.users[0]?.pinHash).toBeUndefined();
    expect(body.customers[0]?.email).toBe('kupac@example.ba');
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]?.id).toBe(invoiceId);
    expect(body.invoices[0]?.lines.length).toBeGreaterThan(0);
    expect(body.fiscalRecords).toHaveLength(1);
    expect(body.devices[0]?.refreshTokenHash).toBeUndefined();
    expect(body.devices[0]?.pushToken).toBeUndefined();

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshTokenHash');
  });

  it('izvoz je ograničen na vlastitu firmu (IDOR)', async () => {
    await setupCompany();
    const second = await registerCompany({
      jib: '7654321098765',
      email: 'drugi@example.ba',
      phone: '+38766123009',
    });

    const response = await request(app.getHttpServer())
      .get('/account/export')
      .set(authHeader(second.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.company.jib).toBe('7654321098765');
    expect(response.body.customers).toHaveLength(0);
    expect(response.body.invoices).toHaveLength(0);
  });

  it('izvoz traži prijavu (401)', async () => {
    await request(app.getHttpServer()).get('/account/export').expect(401);
  });

  it('brisanje traži tačnu potvrdu OBRISI (400)', async () => {
    const { session } = await setupCompany();

    const response = await request(app.getHttpServer())
      .delete('/account')
      .set(authHeader(session.accessToken))
      .send({ confirmation: 'obrisi' });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(1);
  });

  it('anonimizuje nalog i kupce, čuva fiskalne zapise, opoziva sesije', async () => {
    const { session, customerId } = await setupCompany();

    const response = await request(app.getHttpServer())
      .delete('/account')
      .set(authHeader(session.accessToken))
      .send({ confirmation: 'OBRISI' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    expect(user?.status).toBe('deleted');
    expect(user?.email).not.toBe('vlasnik@example.ba');
    expect(user?.phone).not.toBe('+38766123001');

    expect(await prisma.device.count({ where: { userId: session.user.id } })).toBe(0);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(customer?.email).toBeNull();
    expect(customer?.phone).toBeNull();
    expect(customer?.note).toBeNull();
    expect(customer?.name).toBe('Petar Petrović');

    // Fiskalni dokumenti i fakture ostaju (zakonska obaveza).
    expect(await prisma.fiscalRecord.count()).toBe(1);
    expect(await prisma.invoice.count()).toBe(1);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'account.delete' } });
    expect(audit).not.toBeNull();

    // Stara sesija više ne radi.
    await request(app.getHttpServer())
      .get('/account/export')
      .set(authHeader(session.accessToken))
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: PASSWORD })
      .expect(401);
  });
});
