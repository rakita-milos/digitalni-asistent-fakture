import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '@digitalni-asistent/shared';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EmailService } from '../src/modules/auth/email.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TABLES =
  '"audit_log","fiscal_records","reminders","payments","invoice_lines","invoices","sync_queue","devices","users","customers","items","tax_rates","reminder_settings","subscriptions","companies"';

const OLD_PASSWORD = 'staraLozinka123';
const NEW_PASSWORD = 'novaLozinka456';

function resetTokenFrom(messageText: string): string {
  const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(messageText);
  if (!match?.[1]) {
    throw new Error('Token nije pronađen u e-mailu');
  }
  return match[1];
}

describe('Sprint 9 — reset lozinke (§21.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: EmailService;

  const registerCompany = async (): Promise<AuthSession> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        company: {
          name: 'Majstor d.o.o.',
          jib: '9876543210123',
          address: 'Kralja Petra I 1',
          city: 'Banja Luka',
          phone: '+38766123999',
          email: 'reset@example.ba',
        },
        owner: { email: 'reset@example.ba', phone: '+38766123999', password: OLD_PASSWORD },
        device: { platform: 'web' },
      });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  };

  const requestReset = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.ba' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sent: true });

    if (!email.lastMessage) {
      throw new Error('E-mail nije poslan');
    }
    return resetTokenFrom(email.lastMessage.text);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    email = app.get(EmailService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
    email.lastMessage = undefined;
  });

  it('nepostojeći e-mail vraća isti generički odgovor i ne šalje poruku', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nema@example.ba' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sent: true });
    expect(email.lastMessage).toBeUndefined();
  });

  it('puni tok: zahtjev, link, nova lozinka, prijava novom, stara odbijena', async () => {
    const session = await registerCompany();
    const token = await requestReset();

    const reset = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ reset: true });

    const oldLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'reset@example.ba', password: OLD_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'reset@example.ba', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);

    // Reset opoziva sve sesije: refresh token izdat prije reset-a više ne radi.
    const refresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('token se ne može iskoristiti dva puta', async () => {
    await registerCompany();
    const token = await requestReset();

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(200);

    const reuse = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: 'trecaLozinka789' });

    expect(reuse.status).toBe(400);
  });

  it('novi zahtjev invalidira prethodni link', async () => {
    await registerCompany();

    const firstToken = await requestReset();
    const secondToken = await requestReset();
    expect(firstToken).not.toBe(secondToken);

    const firstUse = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: firstToken, password: NEW_PASSWORD });
    expect(firstUse.status).toBe(400);

    const secondUse = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: secondToken, password: NEW_PASSWORD });
    expect(secondUse.status).toBe(200);
  });

  it('odbija neispravan token i prekratku lozinku', async () => {
    await registerCompany();

    const invalid = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'nepostojeci-token-0123456789012345', password: NEW_PASSWORD });
    expect(invalid.status).toBe(400);

    const token = await requestReset();
    const shortPassword = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: 'kratka' });
    expect(shortPassword.status).toBe(400);
  });
});
