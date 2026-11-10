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

interface RegisteredSession {
  accessToken: string;
  userId: string;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Sprint 8 — devices/register i subscriptions (§6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let session: RegisteredSession;

  const registerCompany = async (suffix: string): Promise<RegisteredSession> => {
    const jib = `123456789012${suffix}`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: `Firma ${suffix}`,
          jib,
          address: 'Ulica 1',
          city: 'Banja Luka',
          phone: `+3876612300${suffix}`,
          email: `firma${suffix}@example.ba`,
        },
        owner: { email: `firma${suffix}@example.ba`, phone: `+3876612300${suffix}`, password: PASSWORD },
        device: { platform: 'android', appVersion: '0.1.0' },
      });

    expect(response.status).toBe(201);

    return {
      accessToken: response.body.accessToken as string,
      userId: response.body.user.id as string,
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
    session = await registerCompany('5');
  });

  it('registruje push token trenutnog uređaja', async () => {
    const response = await request(app.getHttpServer())
      .post('/devices/register')
      .set(authHeader(session.accessToken))
      .send({ pushToken: 'fcm-token-abc', appVersion: '0.1.0', platform: 'android' });

    expect(response.status).toBe(200);
    expect(response.body.pushToken).toBe('fcm-token-abc');
    expect(response.body.appVersion).toBe('0.1.0');
    expect(response.body.lastSeenAt).toBeTruthy();

    const device = await prisma.device.findFirstOrThrow({ where: { userId: session.userId } });
    expect(device.pushToken).toBe('fcm-token-abc');
    expect(device.appVersion).toBe('0.1.0');
  });

  it('briše push token slanjem null', async () => {
    await request(app.getHttpServer())
      .post('/devices/register')
      .set(authHeader(session.accessToken))
      .send({ pushToken: 'fcm-token-abc' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/devices/register')
      .set(authHeader(session.accessToken))
      .send({ pushToken: null });

    expect(response.status).toBe(200);
    expect(response.body.pushToken).toBeNull();
  });

  it('odbija registraciju bez access tokena (401)', async () => {
    const response = await request(app.getHttpServer())
      .post('/devices/register')
      .send({ pushToken: 'fcm-token-abc' });

    expect(response.status).toBe(401);
  });

  it('registracija uređaja druge firme ne dira tuđi uređaj', async () => {
    const other = await registerCompany('6');

    await request(app.getHttpServer())
      .post('/devices/register')
      .set(authHeader(session.accessToken))
      .send({ pushToken: 'prvi-token' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/devices/register')
      .set(authHeader(other.accessToken))
      .send({ pushToken: 'drugi-token' })
      .expect(200);

    const firstDevice = await prisma.device.findFirstOrThrow({ where: { userId: session.userId } });
    expect(firstDevice.pushToken).toBe('prvi-token');
  });

  it('vraća null pretplatu dok nije evidentirana i čuva je nakon POST-a', async () => {
    const empty = await request(app.getHttpServer())
      .get('/subscriptions')
      .set(authHeader(session.accessToken));

    expect(empty.status).toBe(200);
    expect(empty.body.subscription).toBeNull();

    const created = await request(app.getHttpServer())
      .post('/subscriptions')
      .set(authHeader(session.accessToken))
      .send({ plan: 'trial', status: 'active', trialEndsAt: '2026-11-24T12:00:00.000Z' });

    expect(created.status).toBe(201);
    expect(created.body.plan).toBe('trial');
    expect(created.body.status).toBe('active');

    const fetched = await request(app.getHttpServer())
      .get('/subscriptions')
      .set(authHeader(session.accessToken));

    expect(fetched.status).toBe(200);
    expect(fetched.body.subscription.plan).toBe('trial');
    expect(fetched.body.subscription.trialEndsAt).toBeTruthy();
  });

  it('mijenja postojeću pretplatu (upsert, jedan zapis)', async () => {
    await request(app.getHttpServer())
      .post('/subscriptions')
      .set(authHeader(session.accessToken))
      .send({ plan: 'trial', status: 'active' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .post('/subscriptions')
      .set(authHeader(session.accessToken))
      .send({
        plan: 'standard',
        status: 'active',
        currentPeriodEnd: '2026-12-10T12:00:00.000Z',
        providerRef: 'prov-123',
      });

    expect(updated.status).toBe(201);
    expect(updated.body.plan).toBe('standard');
    expect(updated.body.providerRef).toBe('prov-123');

    expect(
      await prisma.subscription.count({ where: { companyId: updated.body.companyId as string } }),
    ).toBe(1);
  });
});
