import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SmsService } from '../src/modules/auth/sms.service';
import { ReminderSettingsService } from '../src/modules/reminders/reminder-settings.service';
import { ReminderWorker } from '../src/modules/worker/reminder.worker';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Opt-out podsjetnika (§7.9)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
  let worker: ReminderWorker;
  let token: string;

  const registerCompany = async (): Promise<AuthSession> => {
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
    return response.body as AuthSession;
  };

  const createCustomer = async (options: {
    phone: string;
    reminderOptOut?: boolean;
  }): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({
        name: 'Petar Petrović',
        phone: options.phone,
        ...(options.reminderOptOut !== undefined
          ? { reminderOptOut: options.reminderOptOut }
          : {}),
      });

    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const enableReminders = async (): Promise<void> => {
    await request(app.getHttpServer())
      .put('/reminder-settings')
      .set(authHeader(token))
      .send({
        enabled: true,
        schedule: [{ offsetDays: 0, kind: 'sms' }],
        template: { text: 'Račun {broj} — {iznos} do {rok}.' },
      })
      .expect(200);
  };

  const createIssuedInvoice = async (customerId: string): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        dueDate: new Date(Date.now() - 86_400_000).toISOString(),
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
    worker = new ReminderWorker(prisma, sms, app.get(ReminderSettingsService));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    token = (await registerCompany()).accessToken;
  });

  it('ne zakazuje automatske podsjetnike za opt-out kupca', async () => {
    const customerId = await createCustomer({ phone: '+38766123002', reminderOptOut: true });
    await enableReminders();

    const invoiceId = await createIssuedInvoice(customerId);

    const reminders = await prisma.reminder.findMany({ where: { invoiceId } });
    expect(reminders).toHaveLength(0);
  });

  it('odbija ručni podsjetnik za opt-out kupca (409), a dozvoljava poslije odjave opt-outa', async () => {
    const customerId = await createCustomer({ phone: '+38766123002', reminderOptOut: true });
    const invoiceId = await createIssuedInvoice(customerId);

    const blocked = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/remind`)
      .set(authHeader(token));
    expect(blocked.status).toBe(409);
    expect(await prisma.reminder.count()).toBe(0);

    await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .set(authHeader(token))
      .send({ reminderOptOut: false })
      .expect(200);

    const allowed = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/remind`)
      .set(authHeader(token));
    expect(allowed.status).toBe(201);
    expect(allowed.body.status).toBe('SENT');
  });

  it('worker otkazuje već zakazani podsjetnik kada kupac odjavi', async () => {
    const customerId = await createCustomer({ phone: '+38766123002', reminderOptOut: false });
    await enableReminders();
    const invoiceId = await createIssuedInvoice(customerId);

    const scheduled = await prisma.reminder.findFirstOrThrow({ where: { invoiceId } });
    expect(scheduled.status).toBe('SCHEDULED');

    await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .set(authHeader(token))
      .send({ reminderOptOut: true })
      .expect(200);

    const result = await worker.scan();
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(0);

    const stored = await prisma.reminder.findUniqueOrThrow({ where: { id: scheduled.id } });
    expect(stored.status).toBe('CANCELLED');
    expect(stored.error).toContain('opt-out');
  });
});
