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

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Minimalni UUID v7 generator za testove (server validira v7 oblik). */
function uuidv7(): string {
  const ts = Date.now().toString(16).padStart(12, '0');
  const random = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${random().slice(0, 3)}-8${random().slice(0, 3)}-${random()}${random()}${random()}`;
}

describe('Sprint 5 — offline sync (push/pull)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

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

  const customerPayload = (suffix: string) => ({
    name: `Kupac ${suffix}`,
    phone: '+38766123003',
    city: 'Banja Luka',
  });

  const invoicePayload = (customerId: string) => ({
    customerId,
    issueDate: '2026-11-09T10:00:00.000Z',
    dueDate: '2026-11-24T10:00:00.000Z',
    lines: [{ description: 'Kabl 3x1.5', qtyMilli: 1500, unitPriceFening: 1000, taxRateBp: 1700 }],
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
  });

  it('primjenjuje kupca i fakturu iz batch-a i upisuje sync_queue', async () => {
    const customerId = uuidv7();
    const invoiceId = uuidv7();

    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({
        operations: [
          { entity: 'customer', op: 'create', entityId: customerId, payload: customerPayload('A') },
          {
            entity: 'invoice',
            op: 'create',
            entityId: invoiceId,
            payload: invoicePayload(customerId),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { entity: 'customer', entityId: customerId, status: 'applied' },
      { entity: 'invoice', entityId: invoiceId, status: 'applied' },
    ]);

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.name).toBe('Kupac A');

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.totalFening).toBe(1755n);
    expect(invoice.number).toMatch(/^DRAFT-/);

    const queue = await prisma.syncQueue.findMany({ orderBy: { entity: 'asc' } });
    expect(queue).toHaveLength(2);
    expect(queue.every((row) => row.status === 'DONE')).toBe(true);
  });

  it('je idempotentan: ponovljeni batch vraća duplicate bez dupliranja', async () => {
    const customerId = uuidv7();
    const operation = {
      entity: 'customer' as const,
      op: 'create' as const,
      entityId: customerId,
      payload: customerPayload('B'),
    };

    await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({ operations: [operation] })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({ operations: [operation] });

    expect(second.status).toBe(200);
    expect(second.body.results[0]).toMatchObject({ status: 'duplicate' });
    await expect(prisma.customer.count()).resolves.toBe(1);
  });

  it('vraća failed za neispravan payload, bez rušenja batch-a', async () => {
    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({
        operations: [
          { entity: 'customer', op: 'create', entityId: uuidv7(), payload: { name: '' } },
          {
            entity: 'customer',
            op: 'create',
            entityId: uuidv7(),
            payload: customerPayload('C'),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({ status: 'failed' });
    expect(response.body.results[1]).toMatchObject({ status: 'applied' });

    const failed = await prisma.syncQueue.findMany({ where: { status: 'FAILED' } });
    expect(failed).toHaveLength(1);
  });

  it('odbija fakturu sa tuđim kupcem (failed, bez upisa fakture)', async () => {
    const otherToken = await registerCompany({
      jib: '1234567890124',
      email: 'drugi@example.ba',
      phone: '+38766123002',
    });

    const otherCustomer = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(otherToken))
      .send({ name: 'Tuđi kupac' });

    const invoiceId = uuidv7();
    const response = await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({
        operations: [
          {
            entity: 'invoice',
            op: 'create',
            entityId: invoiceId,
            payload: invoicePayload(otherCustomer.body.id as string),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({ status: 'failed' });
    await expect(prisma.invoice.count()).resolves.toBe(0);
  });

  it('pull vraća kupce i fakture, uz `since` filter', async () => {
    const customerId = uuidv7();
    const invoiceId = uuidv7();

    await request(app.getHttpServer())
      .post('/sync/push')
      .set(authHeader(token))
      .send({
        operations: [
          { entity: 'customer', op: 'create', entityId: customerId, payload: customerPayload('D') },
          {
            entity: 'invoice',
            op: 'create',
            entityId: invoiceId,
            payload: invoicePayload(customerId),
          },
        ],
      })
      .expect(200);

    const pull = await request(app.getHttpServer())
      .get('/sync/pull')
      .set(authHeader(token));

    expect(pull.status).toBe(200);
    expect(pull.body.customers).toHaveLength(1);
    expect(pull.body.invoices).toHaveLength(1);
    expect(pull.body.invoices[0].id).toBe(invoiceId);
    expect(pull.body.invoices[0].customer.name).toBe('Kupac D');

    const future = new Date(Date.now() + 60_000).toISOString();
    const empty = await request(app.getHttpServer())
      .get(`/sync/pull?since=${encodeURIComponent(future)}`)
      .set(authHeader(token));

    expect(empty.status).toBe(200);
    expect(empty.body.invoices).toHaveLength(0);
  });
});
