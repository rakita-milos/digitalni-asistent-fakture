import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  AuthSession,
  DeviceInput,
  LoginInput,
  RegisterInput,
} from '@digitalni-asistent/shared';

import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmailService } from './email.service';
import { PasswordResetService } from './password-reset.service';
import { SmsService } from './sms.service';

interface SessionUser {
  id: string;
  companyId: string;
  email: string;
  phone: string;
  role: string;
}

interface RefreshTokenPayload {
  sub: string;
  companyId: string;
  deviceId: string;
  type: 'refresh';
}

const OTP_MAX_ATTEMPTS = 3;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(first: string, second: string): boolean {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /** POST /auth/register — firma + vlasnik (§6). */
  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await hash(input.owner.password, { type: argon2id });
    const numberingYear = input.company.numberingYear ?? new Date().getUTCFullYear();

    let company: { id: string; name: string; users: SessionUser[] };
    try {
      const created = await this.prisma.company.create({
        data: {
          name: input.company.name,
          jib: input.company.jib,
          address: input.company.address,
          city: input.company.city,
          phone: input.company.phone,
          email: input.company.email.toLowerCase(),
          numberingPrefix: input.company.numberingPrefix,
          numberingYear,
          numberingNext: 1,
          defaultDueDays: input.company.defaultDueDays,
          users: {
            create: {
              email: input.owner.email.toLowerCase(),
              phone: input.owner.phone,
              passwordHash,
              role: 'owner',
              status: 'active',
            },
          },
        },
        include: { users: true },
      });
      company = created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Firma sa tim JIB-om je već registrovana');
      }
      throw error;
    }

    const owner = company.users[0];
    if (!owner) {
      throw new Error('Korisnik nije kreiran');
    }

    return this.issueSession(owner, input.device);
  }

  /** POST /auth/login — email ili telefon + lozinka (§6, §10). */
  async login(input: LoginInput): Promise<AuthSession> {
    const identifier = input.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: { equals: identifier, mode: 'insensitive' } }, { phone: identifier }],
      },
    });

    const passwordValid = user ? await this.verifyPassword(user.passwordHash, input.password) : false;
    if (!user || !passwordValid) {
      throw new UnauthorizedException('Neispravan email/telefon ili lozinka');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Nalog nije aktivan');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(
      {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      input.device,
    );
  }

  /** POST /auth/refresh — rotacija + detekcija ponovne upotrebe (§10). */
  async refresh(refreshToken: string): Promise<AuthSession> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Neispravan refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Neispravan tip tokena');
    }

    const device = await this.prisma.device.findUnique({ where: { id: payload.deviceId } });
    if (!device || device.userId !== payload.sub || !device.refreshTokenHash) {
      throw new UnauthorizedException('Sesija je opozvana');
    }

    if (!safeEqual(device.refreshTokenHash, sha256(refreshToken))) {
      // Ponovna upotreba iskorištenog tokena => opoziv uređaja.
      await this.prisma.device.update({
        where: { id: device.id },
        data: { refreshTokenHash: null, refreshExpiresAt: null },
      });
      this.logger.warn(`Refresh token reuse (device=${device.id}) — sesija opozvana`);
      throw new UnauthorizedException('Sesija je opozvana');
    }

    if (device.refreshExpiresAt && device.refreshExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesija je istekla');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Korisnik nije aktivan');
    }

    return this.issueSession(
      {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      undefined,
      device.id,
    );
  }

  /** POST /auth/otp/request — šalje 6-cifreni kod na telefon (§6). */
  async requestOtp(phone: string): Promise<{ sent: true }> {
    const code = randomInt(100000, 1000000).toString();
    const payload = JSON.stringify({ hash: sha256(code), attempts: 0 });
    await this.redis.setWithTtl(otpKey(phone), payload, env.OTP_TTL_SECONDS);
    await this.sms.send(
      phone,
      `Digitalni Asistent — vaš kod je ${code}. Vrijedi ${Math.round(env.OTP_TTL_SECONDS / 60)} min.`,
    );
    return { sent: true };
  }

  /** POST /auth/otp/verify — provjera koda (§6). */
  async verifyOtp(phone: string, code: string): Promise<{ verified: true }> {
    const key = otpKey(phone);
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new BadRequestException('Kod je istekao ili nije zatražen');
    }

    const stored = JSON.parse(raw) as { hash: string; attempts: number };

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new HttpException(
        { message: ['Previše pokušaja — zatražite novi kod'] },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!safeEqual(stored.hash, sha256(code))) {
      stored.attempts += 1;
      await this.redis.setWithTtl(key, JSON.stringify(stored), env.OTP_TTL_SECONDS);
      throw new BadRequestException('Neispravan kod');
    }

    await this.redis.del(key);
    return { verified: true };
  }

  /**
   * POST /auth/forgot-password — šalje link za reset lozinke (§10, §21.2).
   * Odgovor je uvijek isti da se ne otkrije postoji li nalog.
   */
  async forgotPassword(email: string): Promise<{ sent: true }> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });

    if (user && user.status === 'active') {
      const { token, expiresInSeconds } = await this.passwordReset.create(user.id);
      const link = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const minutes = Math.round(expiresInSeconds / 60);

      try {
        await this.email.send({
          to: user.email,
          subject: 'Reset lozinke — Digitalni Asistent',
          text: [
            'Zdravo,',
            '',
            'Zatražili ste reset lozinke za Digitalni Asistent.',
            `Link vrijedi ${minutes} min i može se iskoristiti samo jednom:`,
            link,
            '',
            'Ako niste zatražili reset, ignorišite ovu poruku.',
          ].join('\n'),
          html: [
            '<p>Zdravo,</p>',
            '<p>Zatražili ste reset lozinke za Digitalni Asistent.</p>',
            `<p><a href="${link}">Postavite novu lozinku</a> — link vrijedi ${minutes} min i može se iskoristiti samo jednom.</p>`,
            '<p>Ako niste zatražili reset, ignorišite ovu poruku.</p>',
          ].join(''),
        });
      } catch (error) {
        // Ne otkrivamo korisniku da slanje nije uspjelo; greška ide u log/monitoring.
        this.logger.error(
          `Slanje e-maila za reset lozinke nije uspjelo: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { sent: true };
  }

  /**
   * POST /auth/reset-password — troši token i postavlja novu lozinku (§21.2).
   * Reset opoziva sve sesije korisnika (refresh hashovi se brišu).
   */
  async resetPassword(token: string, newPassword: string): Promise<{ reset: true }> {
    const userId = await this.passwordReset.consume(token);
    if (!userId) {
      throw new BadRequestException('Link za reset lozinke je istekao ili je već iskorišten');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new BadRequestException('Link za reset lozinke nije valjan');
    }

    const passwordHash = await hash(newPassword, { type: argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.device.updateMany({
        where: { userId: user.id },
        data: { refreshTokenHash: null, refreshExpiresAt: null },
      }),
    ]);

    this.logger.log(`Lozinka promijenjena (user=${user.id}); sesije opozvane`);
    return { reset: true };
  }

  private async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private async issueSession(
    user: SessionUser,
    device: DeviceInput | undefined,
    existingDeviceId?: string,
  ): Promise<AuthSession> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { id: true, name: true },
    });

    const deviceRow = existingDeviceId
      ? await this.prisma.device.update({
          where: { id: existingDeviceId },
          data: { lastSeenAt: new Date() },
        })
      : await this.prisma.device.create({
          data: {
            userId: user.id,
            platform: device?.platform ?? 'web',
            appVersion: device?.appVersion ?? null,
            pushToken: device?.pushToken ?? null,
            lastSeenAt: new Date(),
          },
        });

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        companyId: user.companyId,
        role: user.role,
        deviceId: deviceRow.id,
        type: 'access',
      },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        companyId: user.companyId,
        deviceId: deviceRow.id,
        type: 'refresh',
        // jti garantuje da je svaki rotirani token jedinstven (isti iat u sekundi).
        jti: randomUUID(),
      },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
    );

    await this.prisma.device.update({
      where: { id: deviceRow.id },
      data: {
        refreshTokenHash: sha256(refreshToken),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      company: { id: company.id, name: company.name },
    };
  }
}
