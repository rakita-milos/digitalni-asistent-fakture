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

describe('Sprint 2 — fakture (draft, lista, detalj)', () => {
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

  const createCustomer = async (token: string, name = 'Petar Petrović'): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const invoicePayload = (customerId: string) => ({
    customerId,
    issueDate: '2026-11-09T10:00:00.000Z',
    dueDate: '2026-11-24T10:00:00.000Z',
    lines: [
      {
        description: 'Kabl 3x1.5',
        qtyMilli: 1500,
        unitPriceFening: 1000,
        taxRateBp: 1700,
      },
      {
        description: 'Utičnica',
        qtyMilli: 2000,
        unitPriceFening: 500,
        discountBp: 1000,
        taxRateBp: 1700,
      },
    ],
  });

  const createInvoice = async (token: string, customerId: string) => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send(invoicePayload(customerId));
    expect(response.status).toBe(201);
    return response.body as {
      id: string;
      number: string;
      status: string;
      subtotalFening: number;
      taxFening: number;
      totalFening: number;
      lines: Array<{ position: number; lineTotalFening: number }>;
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

  it('kreira DRAFT fakturu sa obračunatim linijama i totalima', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);

    const invoice = await createInvoice(session.accessToken, customerId);

    expect(invoice.number).toMatch(/^DRAFT-[A-Z0-9]{10}$/);
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.subtotalFening).toBe(2400);
    expect(invoice.taxFening).toBe(408);
    expect(invoice.totalFening).toBe(2808);
    expect(invoice.lines.map((line) => line.position)).toEqual([1, 2]);
    expect(invoice.lines[0]?.lineTotalFening).toBe(1755);
    expect(invoice.lines[1]?.lineTotalFening).toBe(1053);
  });

  it('odbija fakturu bez linija (400)', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);

    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(session.accessToken))
      .send({ ...invoicePayload(customerId), lines: [] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  it('odbija dospijeće prije datuma izdavanja (400)', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);

    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(session.accessToken))
      .send({ ...invoicePayload(customerId), dueDate: '2026-11-08T10:00:00.000Z' });

    expect(response.status).toBe(400);
  });

  it('ne dozvoljava kupca druge firme (404)', async () => {
    const first = await registerCompany({
      jib: '1234567890123',
      email: 'prvi@example.ba',
      phone: '+38766123001',
    });
    const second = await registerCompany({
      jib: '1234567890124',
      email: 'drugi@example.ba',
      phone: '+38766123002',
    });
    const customerId = await createCustomer(first.accessToken);

    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(second.accessToken))
      .send(invoicePayload(customerId));

    expect(response.status).toBe(404);
  });

  it('lista po statusu, periodu i broju, uz paginaciju', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);
    await createInvoice(session.accessToken, customerId);
    await createInvoice(session.accessToken, customerId);

    const byStatus = await request(app.getHttpServer())
      .get('/invoices?status=DRAFT')
      .set(authHeader(session.accessToken));
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.total).toBe(2);

    const byNumber = await request(app.getHttpServer())
      .get('/invoices?q=DRAFT')
      .set(authHeader(session.accessToken));
    expect(byNumber.body.total).toBe(2);

    const outOfPeriod = await request(app.getHttpServer())
      .get('/invoices?from=2027-01-01T00:00:00.000Z')
      .set(authHeader(session.accessToken));
    expect(outOfPeriod.body.total).toBe(0);

    const paginated = await request(app.getHttpServer())
      .get('/invoices?limit=1')
      .set(authHeader(session.accessToken));
    expect(paginated.body.items).toHaveLength(1);
    expect(paginated.body.total).toBe(2);
  });

  it('vraća detalj sa linijama sortiranim po poziciji', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);
    const invoice = await createInvoice(session.accessToken, customerId);

    const response = await request(app.getHttpServer())
      .get(`/invoices/${invoice.id}`)
      .set(authHeader(session.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.customer.name).toBe('Petar Petrović');
    expect(response.body.lines).toHaveLength(2);
    expect(response.body.lines.map((line: { position: number }) => line.position)).toEqual([1, 2]);
    expect(response.body.totalFening).toBe(2808);
  });

  it('mijenja draft i ponovo obračunava totale', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);
    const invoice = await createInvoice(session.accessToken, customerId);

    const response = await request(app.getHttpServer())
      .patch(`/invoices/${invoice.id}`)
      .set(authHeader(session.accessToken))
      .send({
        lines: [
          { description: 'Nova stavka', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 },
        ],
        note: 'Napomena za kupca',
      });

    expect(response.status).toBe(200);
    expect(response.body.lines).toHaveLength(1);
    expect(response.body.subtotalFening).toBe(1000);
    expect(response.body.taxFening).toBe(170);
    expect(response.body.totalFening).toBe(1170);
    expect(response.body.note).toBe('Napomena za kupca');
  });

  it('odbija izmjenu fakture koja nije DRAFT (409)', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const customerId = await createCustomer(session.accessToken);
    const invoice = await createInvoice(session.accessToken, customerId);

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'ISSUED' } });

    const response = await request(app.getHttpServer())
      .patch(`/invoices/${invoice.id}`)
      .set(authHeader(session.accessToken))
      .send({ note: 'Pokušaj izmjene' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
  });

  it('ne dozvoljava pristup fakturi druge firme (IDOR)', async () => {
    const first = await registerCompany({
      jib: '1234567890123',
      email: 'prvi@example.ba',
      phone: '+38766123001',
    });
    const second = await registerCompany({
      jib: '1234567890124',
      email: 'drugi@example.ba',
      phone: '+38766123002',
    });
    const customerId = await createCustomer(first.accessToken);
    const invoice = await createInvoice(first.accessToken, customerId);

    const getResponse = await request(app.getHttpServer())
      .get(`/invoices/${invoice.id}`)
      .set(authHeader(second.accessToken));
    expect(getResponse.status).toBe(404);

    const patchResponse = await request(app.getHttpServer())
      .patch(`/invoices/${invoice.id}`)
      .set(authHeader(second.accessToken))
      .send({ note: 'tuđa faktura' });
    expect(patchResponse.status).toBe(404);
  });
});
