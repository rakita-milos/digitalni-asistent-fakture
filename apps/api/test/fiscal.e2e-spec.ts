import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { FISCAL_ADAPTER } from '../src/modules/fiscal/fiscal.types';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';
const YEAR = new Date().getUTCFullYear();

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function bootstrapApp(overrideFiscalAdapter = false): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (overrideFiscalAdapter) {
    builder.overrideProvider(FISCAL_ADAPTER).useValue({
      issue: () => Promise.reject(new Error('ESIR nedostupan')),
    });
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe('Sprint 3 — fiskalizacija, numeracija i PDF', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let customerId: string;

  const registerCompany = async (): Promise<string> => {
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
      });

    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  };

  const createCustomer = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Petar Petrović' });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const createInvoice = async (type: 'SALE' | 'ADVANCE' = 'SALE'): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        type,
        issueDate: '2026-11-09T10:00:00.000Z',
        dueDate: '2026-11-24T10:00:00.000Z',
        lines: [
          { description: 'Kabl 3x1.5', qtyMilli: 1500, unitPriceFening: 1000, taxRateBp: 1700 },
        ],
      });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  beforeAll(async () => {
    app = await bootstrapApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    token = await registerCompany();
    customerId = await createCustomer();
  });

  it('izdaje fakturu: fiskalizuje, dodjeljuje broj i prelazi u ISSUED', async () => {
    const invoiceId = await createInvoice();

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('ISSUED');
    expect(response.body.number).toBe(`${YEAR}-0001`);
    expect(response.body.fiscalPfr).toMatch(/^MOCK-1234567890123-[A-F0-9]{12}$/);
    expect(response.body.fiscalQrPayload.length).toBeGreaterThan(10);
    expect(response.body.fiscalAt).toBeTruthy();

    const fiscalRecords = await prisma.fiscalRecord.findMany({ where: { invoiceId } });
    expect(fiscalRecords).toHaveLength(1);
    expect(fiscalRecords[0]?.status).toBe('ISSUED');

    const audit = await prisma.auditLog.findMany({ where: { entityId: invoiceId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('invoice.issue');
  });

  it('numeriše uzastopne fakture bez rupa', async () => {
    const firstId = await createInvoice();
    const secondId = await createInvoice();

    const first = await request(app.getHttpServer())
      .post(`/invoices/${firstId}/issue`)
      .set(authHeader(token));
    const second = await request(app.getHttpServer())
      .post(`/invoices/${secondId}/issue`)
      .set(authHeader(token));

    expect(first.body.number).toBe(`${YEAR}-0001`);
    expect(second.body.number).toBe(`${YEAR}-0002`);
  });

  it('odbija ponovno izdavanje iste fakture (409)', async () => {
    const invoiceId = await createInvoice();

    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token))
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token));

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('CONFLICT');
  });

  it('ne fiskalizuje PRAČUN (ADVANCE) — 409', async () => {
    const invoiceId = await createInvoice('ADVANCE');

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('PRAČUN');
  });

  it('vraća PDF sa PFR i QR kodom', async () => {
    const invoiceId = await createInvoice();
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token))
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/pdf`)
      .set(authHeader(token))
      .buffer(true);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');

    const body = response.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
    expect(body.length).toBeGreaterThan(2000);
  });

  it('ne dozvoljava PDF za tuđu fakturu (404)', async () => {
    const invoiceId = await createInvoice();

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/pdf`)
      .set(authHeader(token))
      .query({});

    expect(response.status).toBe(200);

    const otherToken = await (async () => {
      const created = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          company: {
            name: 'Druga firma',
            jib: '1234567890124',
            address: 'Ulica 2',
            city: 'Sarajevo',
            phone: '+38766123002',
            email: 'drugi@example.ba',
          },
          owner: { email: 'drugi@example.ba', phone: '+38766123002', password: PASSWORD },
        });
      return created.body.accessToken as string;
    })();

    const forbidden = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/pdf`)
      .set(authHeader(otherToken));

    expect(forbidden.status).toBe(404);
  });

  it('vraća QR kod kao PNG za izdatu fakturu', async () => {
    const invoiceId = await createInvoice();
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token))
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/qr`)
      .set(authHeader(token))
      .buffer(true);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');

    const body = response.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(body.length).toBeGreaterThan(200);
  });

  it('ne vraća QR za nefiskalizovanu fakturu (409)', async () => {
    const invoiceId = await createInvoice();

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/qr`)
      .set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
  });

  it('ne dozvoljava QR za tuđu fakturu (404)', async () => {
    const invoiceId = await createInvoice();
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token))
      .expect(201);

    const otherRegister = await request(app.getHttpServer()).post('/auth/register').send({
      company: {
        name: 'Treća firma',
        jib: '1234567890125',
        address: 'Ulica 3',
        city: 'Mostar',
        phone: '+38766123003',
        email: 'treci@example.ba',
      },
      owner: { email: 'treci@example.ba', phone: '+38766123003', password: PASSWORD },
    });
    const otherToken = otherRegister.body.accessToken as string;

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}/qr`)
      .set(authHeader(otherToken));

    expect(response.status).toBe(404);
  });
});

describe('Sprint 3 — ESIR pad (PENDING_FISCAL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await bootstrapApp(true);
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ostavlja fakturu u PENDING_FISCAL i vraća 502 kada ESIR padne', async () => {
    const register = await request(app.getHttpServer())
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
      });
    const token = register.body.accessToken as string;

    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Petar Petrović' });

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId: customer.body.id as string,
        issueDate: '2026-11-09T10:00:00.000Z',
        dueDate: '2026-11-24T10:00:00.000Z',
        lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
      });

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoice.body.id as string}/issue`)
      .set(authHeader(token));

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('BAD_GATEWAY');

    const stored = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.body.id as string },
    });
    expect(stored.status).toBe('PENDING_FISCAL');
    expect(stored.fiscalPfr).toBeNull();
    expect(stored.number).toMatch(/^DRAFT-/);

    const records = await prisma.fiscalRecord.findMany({ where: { invoiceId: stored.id } });
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('FAILED');
  });
});
