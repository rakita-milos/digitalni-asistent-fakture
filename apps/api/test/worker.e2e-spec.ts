import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MonitoringService } from '../src/common/monitoring/monitoring.service';
import { SmsService } from '../src/modules/auth/sms.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { ReminderSettingsService } from '../src/modules/reminders/reminder-settings.service';
import { FiscalRetryWorker } from '../src/modules/worker/fiscal-retry.worker';
import { ReminderWorker } from '../src/modules/worker/reminder.worker';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';
const YEAR = new Date().getUTCFullYear();

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Worker logika se testira direktno preko `scan()` (bez BullMQ queue-a),
 * pa test ne zavisi od Redis schedulera.
 */
describe('Sprint 5 — worker (podsjetnici + fiskalni retry)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
  let reminders: ReminderWorker;
  let fiscalRetry: FiscalRetryWorker;
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
      .send({ name: 'Petar Petrović', phone: '+38766123003' });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const createIssuedInvoice = async (dueDate: string): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        dueDate,
        lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
      });
    expect(created.status).toBe(201);

    const issued = await request(app.getHttpServer())
      .post(`/invoices/${created.body.id as string}/issue`)
      .set(authHeader(token));
    expect(issued.status).toBe(201);
    return issued.body.id as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
    reminders = new ReminderWorker(
      prisma,
      sms,
      app.get(ReminderSettingsService),
      app.get(AnalyticsService),
    );
    fiscalRetry = new FiscalRetryWorker(
      prisma,
      app.get(InvoicesService),
      app.get(RedisService),
      app.get(MonitoringService),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    token = await registerCompany();
    customerId = await createCustomer();
  });

  it('šalje dospjeli automatski podsjetnik', async () => {
    await request(app.getHttpServer())
      .put('/reminder-settings')
      .set(authHeader(token))
      .send({
        enabled: true,
        schedule: [{ offsetDays: 0, kind: 'sms' }],
        template: { text: 'Račun {broj} — {iznos} do {rok}.' },
      })
      .expect(200);

    const invoiceId = await createIssuedInvoice(new Date(Date.now() - 86_400_000).toISOString());

    const result = await reminders.scan();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);

    const stored = await prisma.reminder.findFirstOrThrow({ where: { invoiceId } });
    expect(stored.status).toBe('SENT');
    expect(stored.sentAt).not.toBeNull();
    expect(sms.lastMessage?.text).toContain(`${YEAR}-0001`);
  });

  it('otkazuje podsjetnik kada je faktura plaćena', async () => {
    await request(app.getHttpServer())
      .put('/reminder-settings')
      .set(authHeader(token))
      .send({
        enabled: true,
        schedule: [{ offsetDays: 0, kind: 'sms' }],
        template: { text: 'Račun {broj} — {iznos}.' },
      })
      .expect(200);

    const invoiceId = await createIssuedInvoice(new Date(Date.now() - 86_400_000).toISOString());

    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set(authHeader(token))
      .send({ amountFening: 1170, method: 'CASH' })
      .expect(201);

    const result = await reminders.scan();
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(0);

    const stored = await prisma.reminder.findFirstOrThrow({ where: { invoiceId } });
    expect(stored.status).toBe('CANCELLED');
  });

  it('ponavlja fiskalizaciju PENDING_FISCAL fakture', async () => {
    // Realan scenario: prvo izdavanje nije uspjelo, faktura je ostala u PENDING_FISCAL
    // (broj nije dodijeljen, zadržava DRAFT-…).
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
      });
    expect(created.status).toBe(201);
    const invoiceId = created.body.id as string;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PENDING_FISCAL' },
    });
    await prisma.fiscalRecord.create({
      data: {
        invoiceId,
        status: 'FAILED',
        createdAt: new Date(Date.now() - 10 * 60_000),
        esirResponseJson: { error: 'ESIR nedostupan' },
      },
    });

    const result = await fiscalRetry.scan();
    expect(result.processed).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(1);

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(stored.status).toBe('ISSUED');
    expect(stored.fiscalPfr).not.toBeNull();
    expect(stored.number).toBe(`${YEAR}-0001`);

    const records = await prisma.fiscalRecord.findMany({ where: { invoiceId } });
    expect(records.filter((record) => record.status === 'ISSUED')).toHaveLength(1);
    expect(records.filter((record) => record.status === 'FAILED')).toHaveLength(1);
  });

  it('diže dnevni alarm za PENDING_FISCAL stariji od 3 dana (sa dedupe)', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        lines: [{ description: 'Kabl', qtyMilli: 1000, unitPriceFening: 1000, taxRateBp: 1700 }],
      });
    expect(created.status).toBe(201);
    const invoiceId = created.body.id as string;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PENDING_FISCAL',
        updatedAt: new Date(Date.now() - 4 * 86_400_000),
      },
    });

    // 5 neuspjelih pokušaja = retry backoff je iscrpljen, faktura ostaje PENDING_FISCAL.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await prisma.fiscalRecord.create({
        data: {
          invoiceId,
          status: 'FAILED',
          createdAt: new Date(Date.now() - (6 - attempt) * 3_600_000),
          esirResponseJson: { error: 'ESIR nedostupan' },
        },
      });
    }

    const first = await fiscalRetry.scan();
    expect(first.processed).toBe(1);
    expect(first.alarms).toBe(1);

    const second = await fiscalRetry.scan();
    expect(second.alarms).toBe(0);

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(stored.status).toBe('PENDING_FISCAL');
  });
});
