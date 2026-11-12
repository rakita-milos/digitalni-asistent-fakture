import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EmailService } from '../src/modules/auth/email.service';
import { SmsService } from '../src/modules/auth/sms.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 9 — slanje fakture e-mailom/SMS-om (§6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let sms: SmsService;

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

  const createCustomer = async (
    token: string,
    contact: { email?: string; phone?: string } = {},
  ): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .set(authHeader(token))
      .send({ name: 'Petar Petrović', ...contact });

    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const createInvoice = async (token: string, customerId: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .set(authHeader(token))
      .send({
        customerId,
        issueDate: '2026-11-09T10:00:00.000Z',
        dueDate: '2026-11-24T10:00:00.000Z',
        lines: [
          { description: 'Kabl 3x1.5', qtyMilli: 1500, unitPriceFening: 1000, taxRateBp: 1700 },
        ],
      });

    expect(response.status).toBe(201);
    return response.body.id as string;
  };

  const issueInvoice = async (token: string, invoiceId: string): Promise<void> => {
    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/issue`)
      .set(authHeader(token));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('ISSUED');
  };

  const setupIssuedInvoice = async (
    contact: { email?: string; phone?: string } = {},
    company: { jib: string; email: string; phone: string } = {
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    },
  ): Promise<{ session: AuthSession; invoiceId: string }> => {
    const session = await registerCompany(company);
    const customerId = await createCustomer(session.accessToken, contact);
    const invoiceId = await createInvoice(session.accessToken, customerId);
    await issueInvoice(session.accessToken, invoiceId);
    return { session, invoiceId };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    email = app.get(EmailService);
    sms = app.get(SmsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    email.lastMessage = undefined;
    sms.lastMessage = undefined;
  });

  it('šalje e-mail sa PDF prilogom i upisuje audit', async () => {
    const { session, invoiceId } = await setupIssuedInvoice({
      email: 'kupac@example.ba',
      phone: '+38766123002',
    });

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'EMAIL' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ sent: true, channel: 'EMAIL', to: 'kupac@example.ba' });

    const message = email.lastMessage;
    expect(message?.to).toBe('kupac@example.ba');
    expect(message?.subject).toContain('Faktura');
    expect(message?.attachments?.[0]?.content.subarray(0, 4).toString()).toBe('%PDF');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'invoice.send', entityId: invoiceId },
    });
    expect(audit?.userId).toBe(session.user.id);
    expect((audit?.metaJson as { channel?: string }).channel).toBe('EMAIL');
  });

  it('šalje SMS sa kratkotrajnim linkom koji vraća PDF bez prijave', async () => {
    const { session, invoiceId } = await setupIssuedInvoice({
      email: 'kupac@example.ba',
      phone: '+38766123002',
    });

    const response = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'SMS' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ sent: true, channel: 'SMS', to: '+38766123002' });

    const text = sms.lastMessage?.text ?? '';
    expect(sms.lastMessage?.phone).toBe('+38766123002');
    expect(text).toContain('faktura');
    expect(text).toContain(`/public/invoices/${invoiceId}/pdf?t=`);

    const link = /https?:\/\/\S+/.exec(text)?.[0];
    expect(link).toBeDefined();

    const url = new URL(link as string);
    const pdf = await request(app.getHttpServer()).get(`${url.pathname}${url.search}`);

    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(Number(pdf.headers['content-length'])).toBeGreaterThan(1000);
  });

  it('javni link odbija neispravan token (401)', async () => {
    const { invoiceId } = await setupIssuedInvoice({
      email: 'kupac@example.ba',
      phone: '+38766123002',
    });

    const response = await request(app.getHttpServer()).get(
      `/public/invoices/${invoiceId}/pdf?t=nije-token`,
    );
    expect(response.status).toBe(401);
  });

  it('odbija slanje drafta (409) i fakturu bez kontakta (400)', async () => {
    const session = await registerCompany({
      jib: '1234567890124',
      email: 'drugi@example.ba',
      phone: '+38766123003',
    });
    const customerId = await createCustomer(session.accessToken);
    const invoiceId = await createInvoice(session.accessToken, customerId);

    const draft = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'EMAIL' });
    expect(draft.status).toBe(409);

    await issueInvoice(session.accessToken, invoiceId);

    const noContact = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'EMAIL' });
    expect(noContact.status).toBe(400);

    const noContactSms = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'SMS' });
    expect(noContactSms.status).toBe(400);
  });

  it('prihvata eksplicitnog primaoca i odbija neispravan format (400)', async () => {
    const { session, invoiceId } = await setupIssuedInvoice({
      email: 'kupac@example.ba',
      phone: '+38766123002',
    });

    const override = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'EMAIL', to: 'racunovodstvo@example.ba' });
    expect(override.status).toBe(201);
    expect(email.lastMessage?.to).toBe('racunovodstvo@example.ba');

    const invalid = await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/send`)
      .set(authHeader(session.accessToken))
      .send({ channel: 'EMAIL', to: 'nije-email' });
    expect(invalid.status).toBe(400);
  });

  it('ne dozvoljava slanje tuđe fakture (IDOR 404)', async () => {
    const first = await setupIssuedInvoice(
      { email: 'kupac@example.ba', phone: '+38766123002' },
      { jib: '1234567890123', email: 'prvi@example.ba', phone: '+38766123001' },
    );

    const second = await registerCompany({
      jib: '7654321098765',
      email: 'drugi@example.ba',
      phone: '+38766123009',
    });

    const response = await request(app.getHttpServer())
      .post(`/invoices/${first.invoiceId}/send`)
      .set(authHeader(second.accessToken))
      .send({ channel: 'EMAIL' });

    expect(response.status).toBe(404);
  });
});
