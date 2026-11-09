import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SmsService } from '../src/modules/auth/sms.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

const DAY_MS = 86_400_000;
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * DAY_MS).toISOString();

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 4 — naplata, podsjetnici, izvještaji', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
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

  const createCustomer = async (withPhone = true): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Petar Petrović', ...(withPhone ? { phone: '+38766123003' } : {}) });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const createInvoice = async (options: {
    customerId?: string;
    issueDate: string;
    dueDate: string;
    priceFening?: number;
  }): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId: options.customerId ?? customerId,
        issueDate: options.issueDate,
        dueDate: options.dueDate,
        lines: [
          {
            description: 'Kabl 3x1.5',
            qtyMilli: 1000,
            unitPriceFening: options.priceFening ?? 1000,
            taxRateBp: 1700,
          },
        ],
      });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const issueInvoice = async (invoiceId: string): Promise<void> => {
    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token));
    expect(response.status).toBe(201);
  };

  const pay = (invoiceId: string, amountFening: number, paidAt?: string) => {
    return request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set(authHeader(token))
      .send({ amountFening, method: 'CASH', ...(paidAt ? { paidAt } : {}) });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    token = await registerCompany();
    customerId = await createCustomer();
  });

  describe('naplata (§7.8)', () => {
    it('djelimična naplata prelazi u PARTIALLY_PAID, druga naplata u PAID', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);

      const first = await pay(invoiceId, 500);
      expect(first.status).toBe(201);
      expect(first.body.payment.amountFening).toBe(500);
      expect(first.body.invoice.status).toBe('PARTIALLY_PAID');
      expect(first.body.invoice.paidFening).toBe(500);

      const second = await pay(invoiceId, 670);
      expect(second.status).toBe(201);
      expect(second.body.invoice.status).toBe('PAID');
      expect(second.body.invoice.paidFening).toBe(1170);
      expect(second.body.invoice.payments).toHaveLength(2);

      const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(stored.status).toBe('PAID');
      expect(stored.paidFening).toBe(1170n);

      const audit = await prisma.auditLog.findMany({ where: { entityId: invoiceId } });
      expect(audit.filter((entry) => entry.action === 'payment.create')).toHaveLength(2);
    });

    it('odbija preplatu (400)', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);

      const response = await pay(invoiceId, 2000);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(String(response.body.details)).toContain('ostatak duga');
    });

    it('odbija naplatu DRAFT fakture (409)', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });

      const response = await pay(invoiceId, 500);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('ne dozvoljava naplatu tuđe fakture (404)', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);

      const secondToken = await registerCompany({
        jib: '1234567890124',
        email: 'drugi@example.ba',
        phone: '+38766123002',
      });

      const response = await request(app.getHttpServer())
        .post(`/invoices/${invoiceId}/payments`)
        .set(authHeader(secondToken))
        .send({ amountFening: 100, method: 'CASH' });

      expect(response.status).toBe(404);
    });
  });

  describe('podsjetnici (§7.9)', () => {
    it('vraća default podešavanja dok firma nema svoja', async () => {
      const response = await request(app.getHttpServer())
        .get('/reminder-settings')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
      expect(response.body.schedule).toEqual([]);
      expect(response.body.template.text).toContain('{broj}');
    });

    it('čuva plan i šablon, odbija šablon bez {broj}', async () => {
      const putResponse = await request(app.getHttpServer())
        .put('/reminder-settings')
        .set(authHeader(token))
        .send({
          enabled: true,
          schedule: [
            { offsetDays: -3, kind: 'sms' },
            { offsetDays: 7, kind: 'sms' },
          ],
          template: { text: 'Račun {broj} — {iznos} do {rok}. {firma}' },
        });

      expect(putResponse.status).toBe(200);
      expect(putResponse.body.enabled).toBe(true);
      expect(putResponse.body.schedule).toHaveLength(2);

      const invalid = await request(app.getHttpServer())
        .put('/reminder-settings')
        .set(authHeader(token))
        .send({
          enabled: true,
          schedule: [{ offsetDays: 0, kind: 'sms' }],
          template: { text: 'Podsjetnik bez broja' },
        });

      expect(invalid.status).toBe(400);
      expect(invalid.body.code).toBe('VALIDATION_ERROR');
    });

    it('planira automatske podsjetnike pri izdavanju', async () => {
      await request(app.getHttpServer())
        .put('/reminder-settings')
        .set(authHeader(token))
        .send({
          enabled: true,
          schedule: [
            { offsetDays: -3, kind: 'sms' },
            { offsetDays: 7, kind: 'sms' },
          ],
          template: { text: 'Račun {broj} — {iznos} do {rok}.' },
        })
        .expect(200);

      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-1),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);

      const reminders = await prisma.reminder.findMany({ where: { invoiceId } });
      expect(reminders).toHaveLength(2);
      expect(reminders.map((reminder) => reminder.status)).toEqual(['SCHEDULED', 'SCHEDULED']);
    });

    it('šalje ručni podsjetnik preko SMS adaptera i upisuje ga u listu', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);

      const response = await request(app.getHttpServer())
        .post(`/invoices/${invoiceId}/remind`)
        .set(authHeader(token));

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('SENT');
      expect(response.body.invoiceNumber).toMatch(/^\d{4}-\d{4}$/);

      const message = sms.lastMessage?.text ?? '';
      expect(message).toContain(response.body.invoiceNumber as string);

      const list = await request(app.getHttpServer())
        .get('/reminders')
        .set(authHeader(token));
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);
    });

    it('odbija podsjetnik za plaćenu fakturu (409) i kupca bez telefona (400)', async () => {
      const invoiceId = await createInvoice({
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceId);
      await pay(invoiceId, 1170).expect(201);

      const paidReminder = await request(app.getHttpServer())
        .post(`/invoices/${invoiceId}/remind`)
        .set(authHeader(token));
      expect(paidReminder.status).toBe(409);

      const noPhoneCustomer = await createCustomer(false);
      const invoiceWithoutPhone = await createInvoice({
        customerId: noPhoneCustomer,
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(5),
      });
      await issueInvoice(invoiceWithoutPhone);

      const noPhoneReminder = await request(app.getHttpServer())
        .post(`/invoices/${invoiceWithoutPhone}/remind`)
        .set(authHeader(token));
      expect(noPhoneReminder.status).toBe(400);
    });
  });

  describe('izvještaji', () => {
    it('aging razdvaja current i 1-30 i umanjuje za naplaćeno', async () => {
      const overdueId = await createInvoice({
        issueDate: daysFromNow(-20),
        dueDate: daysFromNow(-5),
      });
      await issueInvoice(overdueId);
      await pay(overdueId, 170).expect(201);

      const futureId = await createInvoice({
        issueDate: daysFromNow(-1),
        dueDate: daysFromNow(10),
      });
      await issueInvoice(futureId);

      const response = await request(app.getHttpServer())
        .get('/reports/receivables')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.totalOutstandingFening).toBe(2170);

      const byKey = Object.fromEntries(
        (response.body.buckets as Array<{ key: string; count: number; amountFening: number }>).map(
          (bucket) => [bucket.key, bucket],
        ),
      );

      expect(byKey['current']).toMatchObject({ count: 1, amountFening: 1170 });
      expect(byKey['1-30']).toMatchObject({ count: 1, amountFening: 1000 });
    });

    it('mjesečni izvještaj sabira izdate i naplaćene po mjesecu', async () => {
      const year = new Date().getUTCFullYear();

      const invoiceId = await createInvoice({
        issueDate: `${year}-02-10T10:00:00.000Z`,
        dueDate: `${year}-02-25T10:00:00.000Z`,
      });
      await issueInvoice(invoiceId);
      await pay(invoiceId, 500, `${year}-03-05T10:00:00.000Z`).expect(201);

      const response = await request(app.getHttpServer())
        .get(`/reports/monthly?year=${year}`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.year).toBe(year);
      expect(response.body.months).toHaveLength(12);
      expect(response.body.months[1]).toMatchObject({
        month: 2,
        issuedCount: 1,
        invoicedFening: 1170,
      });
      expect(response.body.months[2]).toMatchObject({ month: 3, paidFening: 500 });
    });
  });
});
