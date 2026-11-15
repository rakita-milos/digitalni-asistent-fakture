import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const PASSWORD = 'lozinka123';
const NEW_PASSWORD = 'novaLozinka456';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('S11 — profil i lozinka (M-12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const register = async (): Promise<AuthSession> => {
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
        device: { platform: 'android', appVersion: '0.1.0' },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  };

  const login = async (identifier: string, password: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ identifier, password });

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

  it('mijenja telefon bez lozinke i vraća ažuriran profil', async () => {
    const session = await register();

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ phone: '+38766123999' });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ phone: '+38766123999' });
    expect(response.body.user.email).toBe('vlasnik@example.ba');

    // Prijava ide po e-mailu i dalje; telefon u bazi je novi.
    const loginResponse = await login('vlasnik@example.ba', PASSWORD);
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.phone).toBe('+38766123999');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'user.profile_update' } });
    expect(audit?.entity).toBe('user');
  });

  it('traži trenutnu lozinku za promjenu e-maila', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ email: 'novi@example.ba' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ email: 'novi@example.ba', currentPassword: 'pogresna123' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ email: 'novi@example.ba', currentPassword: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('novi@example.ba');

    expect((await login('novi@example.ba', PASSWORD)).status).toBe(200);
    expect((await login('vlasnik@example.ba', PASSWORD)).status).toBe(401);
  });

  it('odbija e-mail koji već postoji u firmi (409)', async () => {
    const session = await register();
    const passwordHash = await hash(PASSWORD, { type: argon2id });

    await prisma.user.create({
      data: {
        companyId: session.user.companyId,
        email: 'zaposleni@example.ba',
        phone: '+38766123002',
        passwordHash,
        role: 'worker',
        status: 'active',
      },
    });

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ email: 'zaposleni@example.ba', currentPassword: PASSWORD });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
  });

  it('odbija izmjenu bez ijednog polja i sa neispravnim telefonom', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(session.accessToken))
      .send({ phone: '066123456' })
      .expect(400);
  });

  it('mijenja lozinku, opoziva ostale uređaje i čuva trenutni', async () => {
    const session = await register();

    // Druga sesija (drugi uređaj) — treba biti opozvana poslije promjene lozinke.
    const otherDevice = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'vlasnik@example.ba', password: PASSWORD, device: { platform: 'web' } });
    expect(otherDevice.status).toBe(200);

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set(authHeader(session.accessToken))
      .send({ currentPassword: 'pogresna123', newPassword: NEW_PASSWORD })
      .expect(400);

    const changed = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set(authHeader(session.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(changed.status).toBe(200);
    expect(changed.body).toEqual({ changed: true });

    // Stara lozinka ne radi, nova radi.
    expect((await login('vlasnik@example.ba', PASSWORD)).status).toBe(401);
    expect((await login('vlasnik@example.ba', NEW_PASSWORD)).status).toBe(200);

    // Sesija drugog uređaja je opozvana; sesija sa koje je lozinka promijenjena i dalje radi.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: (otherDevice.body as AuthSession).refreshToken })
      .expect(401);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'user.password_change' } });
    expect(audit).not.toBeNull();
  });

  it('odbija novu lozinku identičnu trenutnoj', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set(authHeader(session.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
      .expect(400);
  });
});
