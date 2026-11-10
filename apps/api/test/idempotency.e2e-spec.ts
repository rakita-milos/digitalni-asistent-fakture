import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Idempotency-Key (§6, §21)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let customerId: string;

  const registerCompany = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Idempotent d.o.o.',
          jib: '1234567890127',
          address: 'Ulica 5',
          city: 'Banja Luka',
          phone: '+38766123005',
          email: 'idempotent@example.ba',
        },
        owner: { email: 'idempotent@example.ba', phone: '+38766123005', password: PASSWORD },
      });

    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  };

  const createCustomer = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Kupac Idempotent' });

    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const invoiceBody = () => ({
    customerId,
    issueDate: '2026-11-10T10:00:00.000Z',
    dueDate: '2026-11-25T10:00:00.000Z',
    lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
  });

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

  it('isti Idempotency-Key ne pravi duplu fakturu', async () => {
    const key = randomUUID();

    const first = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .set('Idempotency-Key', key)
      .send(invoiceBody());

    const second = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .set('Idempotency-Key', key)
      .send(invoiceBody());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.invoice.count()).toBe(1);
  });

  it('različiti ključevi prave dvije fakture', async () => {
    const first = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .set('Idempotency-Key', randomUUID())
      .send(invoiceBody());

    const second = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .set('Idempotency-Key', randomUUID())
      .send(invoiceBody());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(await prisma.invoice.count()).toBe(2);
  });

  it('isti Idempotency-Key ne pravi duplu naplatu', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send(invoiceBody());

    const issued = await request(app.getHttpServer())
      .post(`/invoices/${created.body.id as string}/issue`)
      .set(authHeader(token));

    expect(issued.status).toBe(201);

    const key = randomUUID();
    const payment = { amountFening: 1170, method: 'CASH' };

    const first = await request(app.getHttpServer())
      .post(`/invoices/${created.body.id as string}/payments`)
      .set(authHeader(token))
      .set('Idempotency-Key', key)
      .send(payment);

    const second = await request(app.getHttpServer())
      .post(`/invoices/${created.body.id as string}/payments`)
      .set(authHeader(token))
      .set('Idempotency-Key', key)
      .send(payment);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(await prisma.payment.count()).toBe(1);

    const stored = await prisma.invoice.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });
    expect(stored.status).toBe('PAID');
    expect(stored.paidFening).toBe(1170n);
  });
});
