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

interface ItemDto {
  id: string;
  name: string;
  unit: string;
  priceFening: number;
  taxRateBp: number;
  archivedAt: string | null;
}

describe('S11 — artikli (PATCH /items/:id)', () => {
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
        device: { platform: 'android' },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  };

  const createItem = async (token: string): Promise<ItemDto> => {
    const response = await request(app.getHttpServer())
      .post('/items')
      .set(authHeader(token))
      .send({ name: 'Zamjena ulja', unit: 'kom', priceFening: 2500, taxRateBp: 1700 });

    expect(response.status).toBe(201);
    return response.body as ItemDto;
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

  it('mijenja naziv, jedinicu, cijenu i stopu artikla', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const item = await createItem(session.accessToken);

    const response = await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({ name: 'Zamjena ulja i filtera', unit: 'set', priceFening: 4500, taxRateBp: 1700 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: item.id,
      name: 'Zamjena ulja i filtera',
      unit: 'set',
      priceFening: 4500,
      taxRateBp: 1700,
    });

    const list = await request(app.getHttpServer())
      .get('/items')
      .set(authHeader(session.accessToken));

    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({ name: 'Zamjena ulja i filtera', priceFening: 4500 });
  });

  it('arhivira artikal (nestaje iz kataloga) i vraća ga iz arhive', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const item = await createItem(session.accessToken);

    const archived = await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({ archivedAt: new Date().toISOString() });

    expect(archived.status).toBe(200);
    expect(archived.body.archivedAt).not.toBeNull();

    const afterArchive = await request(app.getHttpServer())
      .get('/items')
      .set(authHeader(session.accessToken));
    expect(afterArchive.body.items).toHaveLength(0);
    expect(afterArchive.body.total).toBe(0);

    const restored = await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({ archivedAt: null });

    expect(restored.status).toBe(200);
    expect(restored.body.archivedAt).toBeNull();

    const afterRestore = await request(app.getHttpServer())
      .get('/items')
      .set(authHeader(session.accessToken));
    expect(afterRestore.body.items).toHaveLength(1);
  });

  it('tuđi artikal vraća 404 (IDOR)', async () => {
    const first = await registerCompany({
      jib: '1234567890123',
      email: 'prvi@example.ba',
      phone: '+38766123001',
    });
    const second = await registerCompany({
      jib: '9876543210987',
      email: 'drugi@example.ba',
      phone: '+38766123002',
    });
    const item = await createItem(first.accessToken);

    await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(second.accessToken))
      .send({ priceFening: 1 })
      .expect(404);

    // Original nije dirao niko.
    const list = await request(app.getHttpServer())
      .get('/items')
      .set(authHeader(first.accessToken));
    expect(list.body.items[0]).toMatchObject({ id: item.id, priceFening: 2500 });
  });

  it('odbija prazno tijelo i neispravne vrijednosti', async () => {
    const session = await registerCompany({
      jib: '1234567890123',
      email: 'vlasnik@example.ba',
      phone: '+38766123001',
    });
    const item = await createItem(session.accessToken);

    await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({ priceFening: -1 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/items/${item.id}`)
      .set(authHeader(session.accessToken))
      .send({ taxRateBp: 10001 })
      .expect(400);
  });
});
