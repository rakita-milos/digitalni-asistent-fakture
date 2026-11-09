import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';
const YEAR = new Date().getUTCFullYear();

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 5 — poništenje (VOID) i refundacija (REFUND)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let customerId: string;

  const registerCompany = async (options?: {
    jib?: string;
    email?: string;
    phone?: string;
  }): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Majstor d.o.o.',
          jib: options?.jib ?? '1234567890123',
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: options?.phone ?? '+38766123001',
          email: options?.email ?? 'vlasnik@example.ba',
        },
        owner: {
          email: options?.email ?? 'vlasnik@example.ba',
          phone: options?.phone ?? '+38766123001',
          password: PASSWORD,
        },
      });
    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  };

  const createCustomer = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Petar Petrović', phone: '+38766123003' });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const createIssuedInvoice = async (priceFening = 1000): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: '2026-11-01T10:00:00.000Z',
        dueDate: '2026-11-20T10:00:00.000Z',
        lines: [
          { description: 'Kabl 3x1.5', qtyMilli: 1000, unitPriceFening: priceFening, taxRateBp: 1700 },
        ],
      });
    expect(created.status).toBe(201);

    const issued = await request(app.getHttpServer())
      .post(`/invoices/${created.body.id as string}/issue`)
      .set(authHeader(token));
    expect(issued.status).toBe(201);
    return issued.body.id as string;
  };

  const pay = (invoiceId: string, amountFening: number) =>
    request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set(authHeader(token))
      .send({ amountFening, method: 'CASH' });

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
    token = await registerCompany();
    customerId = await createCustomer();
  });

  it('poništava fakturu: novi VOID zapis sa brojem, original prelazi u CANCELLED', async () => {
    const invoiceId = await createIssuedInvoice();

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/cancel`)
      .set(authHeader(token));

    expect(response.status).toBe(201);
    expect(response.body.transactionType).toBe('VOID');
    expect(response.body.status).toBe('CANCELLED');
    expect(response.body.number).toBe(`${YEAR}-0002`);
    expect(response.body.originalInvoiceId).toBe(invoiceId);
    expect(response.body.totalFening).toBe(1170);
    expect(response.body.lines).toHaveLength(1);

    const original = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(original.status).toBe('CANCELLED');
    expect(original.number).toBe(`${YEAR}-0001`);

    const audit = await prisma.auditLog.findMany({
      where: { entityId: invoiceId, action: 'invoice.cancel' },
    });
    expect(audit).toHaveLength(1);
  });

  it('ne poništava DRAFT ni plaćenu fakturu (409)', async () => {
    const draft = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: '2026-11-01T10:00:00.000Z',
        dueDate: '2026-11-20T10:00:00.000Z',
        lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
      });

    const draftCancel = await request(app.getHttpServer())
      .post(`/invoices/${draft.body.id as string}/cancel`)
      .set(authHeader(token));
    expect(draftCancel.status).toBe(409);

    const paidId = await createIssuedInvoice();
    await pay(paidId, 1170).expect(201);

    const paidCancel = await request(app.getHttpServer())
      .post(`/invoices/${paidId}/cancel`)
      .set(authHeader(token));
    expect(paidCancel.status).toBe(409);
    expect(paidCancel.body.message).toContain('refundaciju');
  });

  it('refundira plaćenu fakturu: novi REFUND zapis, original ostaje PAID', async () => {
    const invoiceId = await createIssuedInvoice();
    await pay(invoiceId, 1170).expect(201);

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 500, note: 'Djelimična refundacija' });

    expect(response.status).toBe(201);
    expect(response.body.transactionType).toBe('REFUND');
    expect(response.body.status).toBe('ISSUED');
    expect(response.body.totalFening).toBe(500);
    expect(response.body.originalInvoiceId).toBe(invoiceId);

    const original = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(original.status).toBe('PAID');
    expect(original.transactionType).toBe('SALE');

    const audit = await prisma.auditLog.findMany({
      where: { entityId: invoiceId, action: 'invoice.refund' },
    });
    expect(audit).toHaveLength(1);
  });

  it('odbija refundaciju bez naplate (409) i iznos veći od naplaćenog (400)', async () => {
    const unpaidId = await createIssuedInvoice();

    const unpaid = await request(app.getHttpServer())
      .post(`/invoices/${unpaidId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 100 });
    expect(unpaid.status).toBe(409);

    await pay(unpaidId, 1170).expect(201);

    const tooMuch = await request(app.getHttpServer())
      .post(`/invoices/${unpaidId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 2000 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.code).toBe('VALIDATION_ERROR');
  });

  it('ograničava kumulativne refundacije na naplaćeni iznos', async () => {
    const invoiceId = await createIssuedInvoice();
    await pay(invoiceId, 1170).expect(201);

    const first = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 700 });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 700 });
    expect(second.status).toBe(400);

    const remaining = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/refund`)
      .set(authHeader(token))
      .send({ amountFening: 470 });
    expect(remaining.status).toBe(201);
  });

  it('ne dozvoljava storno/refundaciju tuđe fakture (404)', async () => {
    const invoiceId = await createIssuedInvoice();
    await pay(invoiceId, 1170).expect(201);

    const secondToken = await registerCompany({
      jib: '1234567890124',
      email: 'drugi@example.ba',
      phone: '+38766123002',
    });

    const cancelResponse = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/cancel`)
      .set(authHeader(secondToken));
    expect(cancelResponse.status).toBe(404);

    const refundResponse = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/refund`)
      .set(authHeader(secondToken))
      .send({ amountFening: 100 });
    expect(refundResponse.status).toBe(404);
  });
});
