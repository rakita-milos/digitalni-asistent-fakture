import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import type { DeleteAccountInput } from '@digitalni-asistent/shared';

import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GDPR izvoz i brisanje naloga (§10, §21.12).
 *
 * Brisanje je anonimizacija ličnih podataka, ne fizičko brisanje:
 * fiskalni dokumenti, fakture i audit trag ostaju zbog zakonskih obaveza.
 * Kontakt podaci kupaca se brišu, ali ime/JIB/adresa ostaju jer su na fiskalnom računu.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async requireActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Nalog nije aktivan');
    }
    return user;
  }

  /** GET /account/export — svi podaci firme u JSON-u, bez hash-eva i tajni. */
  async export(userId: string, companyId: string) {
    await this.requireActiveUser(userId);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Firma nije pronađena');
    }

    const [
      users,
      devices,
      customers,
      items,
      taxRates,
      invoices,
      reminders,
      reminderSettings,
      fiscalRecords,
      auditLog,
      subscriptions,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.device.findMany({
        where: { user: { companyId } },
        select: { id: true, userId: true, platform: true, appVersion: true, lastSeenAt: true },
      }),
      this.prisma.customer.findMany({ where: { companyId } }),
      this.prisma.item.findMany({ where: { companyId } }),
      this.prisma.taxRate.findMany({ where: { companyId } }),
      this.prisma.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        include: {
          lines: { orderBy: { position: 'asc' } },
          payments: { orderBy: { paidAt: 'asc' } },
        },
      }),
      this.prisma.reminder.findMany({
        where: { invoice: { companyId } },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.reminderSetting.findMany({ where: { companyId } }),
      this.prisma.fiscalRecord.findMany({
        where: { invoice: { companyId } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.subscription.findMany({ where: { companyId } }),
    ]);

    return toJsonSafe({
      exportedAt: new Date().toISOString(),
      note: 'Izvoz ne sadrži hash-eve lozinki, PIN-ova ni refresh tokena.',
      company,
      users,
      devices,
      customers,
      items,
      taxRates,
      invoices,
      reminders,
      reminderSettings,
      fiscalRecords,
      auditLog,
      subscriptions,
    }) as Record<string, unknown>;
  }

  /**
   * DELETE /account — anonimizacija naloga vlasnika i kontakt podataka kupaca.
   * Fiskalni dokumenti, fakture i audit ostaju (zakonska obaveza čuvanja).
   */
  async delete(userId: string, companyId: string, input: DeleteAccountInput) {
    if (!env.FEATURE_ACCOUNT_DELETION) {
      throw new ServiceUnavailableException('Brisanje naloga je privremeno isključeno');
    }
    if (input.confirmation !== 'OBRISI') {
      throw new ForbiddenException('Potvrda brisanja nije ispravna');
    }

    const user = await this.requireActiveUser(userId);
    if (user.role !== 'owner') {
      throw new ForbiddenException('Samo vlasnik može obrisati nalog');
    }

    // Nasumični hash — nijedna lozinka ga ne može pogoditi (argon2 verify uvijek pada).
    const unusableHash = randomBytes(32).toString('hex');
    const anonymizedEmail = `obrisan+${user.id}@invalid.local`;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anonymizedEmail,
          phone: '+38700000000',
          passwordHash: unusableHash,
          pinHash: null,
          status: 'deleted',
          lastLoginAt: null,
        },
      });

      // Kontakt podaci kupaca se brišu; ime/JIB/adresa ostaju jer su na fiskalnom računu.
      await tx.customer.updateMany({
        where: { companyId },
        data: { email: null, phone: null, note: null },
      });

      // Uređaji i refresh tokeni se brišu (sync_queue kaskadno).
      await tx.device.deleteMany({ where: { userId: user.id } });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: user.id,
          action: 'account.delete',
          entity: 'user',
          entityId: user.id,
          metaJson: { anonymizedEmail },
        },
      });
    });

    this.logger.log(`Nalog anonimizovan (user=${user.id}); fiskalni podaci zadržani`);
    return { deleted: true };
  }
}

/** Prisma vraća BigInt za iznose — JSON ne može da ga serijalizuje. */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toJsonSafe(item),
      ]),
    );
  }
  return value;
}
