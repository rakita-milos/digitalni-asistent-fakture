import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SmsService } from '../src/modules/auth/sms.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 1 — auth, firma, kupci, artikli, porezi', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;

  const registerCompany = async (options: {
    jib: string;
    email: string;
    phone: string;
    name?: string;
  }): Promise<AuthSession> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: options.name ?? 'Majstor d.o.o.',
          jib: options.jib,
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: options.phone,
          email: options.email,
        },
        owner: { email: options.email, phone: options.phone, password: PASSWORD },
        device: { platform: 'android', appVersion: '0.1.0' },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
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
  });

  describe('auth', () => {
    it('registruje firmu i vlasnika, vraća sesiju', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      expect(session.accessToken.length).toBeGreaterThan(20);
      expect(session.refreshToken.length).toBeGreaterThan(20);
      expect(session.user.role).toBe('owner');
      expect(session.company.name).toBe('Majstor d.o.o.');
    });

    it('odbija registraciju sa istim JIB-om (409)', async () => {
      await registerCompany({
        jib: '1234567890123',
        email: 'prvi@example.ba',
        phone: '+38766123001',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          company: {
            name: 'Drugi',
            jib: '1234567890123',
            address: 'Ulica 2',
            city: 'Sarajevo',
            phone: '+38766123002',
            email: 'drugi@example.ba',
          },
          owner: { email: 'drugi@example.ba', phone: '+38766123002', password: PASSWORD },
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('prijavljuje vlasnika emailom', async () => {
      await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'vlasnik@example.ba', password: PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('vlasnik@example.ba');
    });

    it('odbija pogrešnu lozinku (401)', async () => {
      await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'vlasnik@example.ba', password: 'pogresna123' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('rotira refresh token i opoziva sesiju pri ponovnoj upotrebi', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const first = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(first.status).toBe(200);
      expect(first.body.refreshToken).not.toBe(session.refreshToken);

      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(replay.status).toBe(401);

      const afterRevoke = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: first.body.refreshToken });
      expect(afterRevoke.status).toBe(401);
    });

    it('štiti rute bez access tokena (401)', async () => {
      const response = await request(app.getHttpServer()).get('/company');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('šalje i provjerava OTP kod (mock SMS adapter)', async () => {
      const phone = '+38766123009';

      const requestResponse = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ phone });
      expect(requestResponse.status).toBe(200);
      expect(requestResponse.body).toEqual({ sent: true });

      const text = sms.lastMessage?.text ?? '';
      const match = /(\d{6})/.exec(text);
      expect(match).not.toBeNull();
      const code = match?.[1] ?? '';

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone, code });
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toEqual({ verified: true });

      const secondVerify = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone, code });
      expect(secondVerify.status).toBe(400);
    });
  });

  describe('firma', () => {
    it('vraća profil firme i dozvoljava izmjenu vlasniku', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const getResponse = await request(app.getHttpServer())
        .get('/company')
        .set(authHeader(session.accessToken));
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.jib).toBe('1234567890123');

      const patchResponse = await request(app.getHttpServer())
        .patch('/company')
        .set(authHeader(session.accessToken))
        .send({ city: 'Sarajevo', defaultDueDays: 30 });
      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.city).toBe('Sarajevo');
      expect(patchResponse.body.defaultDueDays).toBe(30);
    });

    it('zabranjuje izmjenu firme radniku (403)', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      await prisma.user.create({
        data: {
          companyId: session.user.companyId,
          email: 'radnik@example.ba',
          phone: '+38766123002',
          passwordHash: await hash(PASSWORD),
          role: 'worker',
          status: 'active',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'radnik@example.ba', password: PASSWORD });
      expect(loginResponse.status).toBe(200);

      const patchResponse = await request(app.getHttpServer())
        .patch('/company')
        .set(authHeader(loginResponse.body.accessToken as string))
        .send({ city: 'Mostar' });

      expect(patchResponse.status).toBe(403);
      expect(patchResponse.body.code).toBe('FORBIDDEN');
    });
  });

  describe('kupci', () => {
    it('kreira, traži, arhivira i više ne prikazuje kupca u listi', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });
      const token = session.accessToken;

      const createResponse = await request(app.getHttpServer())
        .post('/customers')
        .set(authHeader(token))
        .send({ name: 'Petar Petrović', phone: '+38766123003', jib: '1234567890123' });
      expect(createResponse.status).toBe(201);
      const customerId = createResponse.body.id as string;
      expect(customerId).toBeTruthy();

      const searchResponse = await request(app.getHttpServer())
        .get('/customers?q=petar')
        .set(authHeader(token));
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.total).toBe(1);

      const detailResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}`)
        .set(authHeader(token));
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.name).toBe('Petar Petrović');

      const archiveResponse = await request(app.getHttpServer())
        .patch(`/customers/${customerId}`)
        .set(authHeader(token))
        .send({ archivedAt: new Date().toISOString() });
      expect(archiveResponse.status).toBe(200);
      expect(archiveResponse.body.archivedAt).not.toBeNull();

      const listAfterArchive = await request(app.getHttpServer())
        .get('/customers')
        .set(authHeader(token));
      expect(listAfterArchive.body.total).toBe(0);
    });

    it('ne dozvoljava pristup kupcu druge firme (IDOR)', async () => {
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

      const created = await request(app.getHttpServer())
        .post('/customers')
        .set(authHeader(first.accessToken))
        .send({ name: 'Kupac prve firme' });

      const response = await request(app.getHttpServer())
        .get(`/customers/${created.body.id as string}`)
        .set(authHeader(second.accessToken));

      expect(response.status).toBe(404);
    });
  });

  describe('artikli', () => {
    it('kreira artikal i vraća cijenu kao number (BigInt → JSON)', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const createResponse = await request(app.getHttpServer())
        .post('/items')
        .set(authHeader(session.accessToken))
        .send({ name: 'Kabl 3x1.5', unit: 'm', priceFening: 250, taxRateBp: 1700 });
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.priceFening).toBe(250);

      const listResponse = await request(app.getHttpServer())
        .get('/items')
        .set(authHeader(session.accessToken));
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.total).toBe(1);
      expect(listResponse.body.items[0].priceFening).toBe(250);
    });
  });

  describe('porezne stope', () => {
    it('kreira i vraća stope firme', async () => {
      const session = await registerCompany({
        jib: '1234567890123',
        email: 'vlasnik@example.ba',
        phone: '+38766123001',
      });

      const createResponse = await request(app.getHttpServer())
        .post('/tax-rates')
        .set(authHeader(session.accessToken))
        .send({ name: 'PDV 17%', rateBp: 1700, sufCode: 'S' });
      expect(createResponse.status).toBe(201);

      const listResponse = await request(app.getHttpServer())
        .get('/tax-rates')
        .set(authHeader(session.accessToken));
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.total).toBe(1);
      expect(listResponse.body.items[0].rateBp).toBe(1700);
    });
  });
});
