import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { ListQuery } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../auth/sms.service';
import { ReminderSettingsService } from './reminder-settings.service';

const REMINDABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

function formatFening(value: bigint): string {
  return `${(Number(value) / 100).toFixed(2)} KM`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('bs-BA', {
    timeZone: 'Europe/Sarajevo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(broj|iznos|rok|firma)\}/g, (_match, key: string) => values[key] ?? '');
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ReminderSettingsService,
    private readonly sms: SmsService,
  ) {}

  /** GET /reminders — lista podsjetnika firme (preko fakture). */
  async list(companyId: string, query: ListQuery) {
    const where: Prisma.ReminderWhereInput = { invoice: { companyId } };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reminder.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          invoice: { select: { id: true, number: true, totalFening: true, paidFening: true } },
        },
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return {
      items: items.map((reminder) => ({
        id: reminder.id,
        invoiceId: reminder.invoiceId,
        invoiceNumber: reminder.invoice.number,
        kind: reminder.kind,
        scheduledAt: reminder.scheduledAt,
        sentAt: reminder.sentAt,
        status: reminder.status,
        providerMessageId: reminder.providerMessageId,
        error: reminder.error,
      })),
      total,
    };
  }

  /** POST /invoices/:id/remind — ručni podsjetnik (§6). */
  async sendManual(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, company: true },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    if (!REMINDABLE_STATUSES.includes(invoice.status as (typeof REMINDABLE_STATUSES)[number])) {
      throw new ConflictException('Podsjetnik nije moguć za fakturu u ovom statusu');
    }

    if (!invoice.customer.phone) {
      throw new BadRequestException({
        message: ['Kupac nema telefon — podsjetnik se ne može poslati'],
      });
    }

    const settings = await this.settings.get(companyId);
    const remaining = invoice.totalFening - invoice.paidFening;

    const text = renderTemplate(settings.template.text, {
      broj: invoice.number,
      iznos: formatFening(remaining),
      rok: formatDate(invoice.dueDate),
      firma: invoice.company.name,
    });

    let status: 'SENT' | 'FAILED' = 'SENT';
    let error: string | null = null;

    try {
      await this.sms.send(invoice.customer.phone, text);
    } catch (caught) {
      status = 'FAILED';
      error = (caught as Error).message;
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        invoiceId,
        kind: 'manual',
        scheduledAt: new Date(),
        sentAt: status === 'SENT' ? new Date() : null,
        status,
        error,
      },
    });

    if (status === 'FAILED') {
      throw new HttpException(
        { message: ['Podsjetnik nije poslan — provjerite SMS provajdera'] },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      id: reminder.id,
      invoiceId: reminder.invoiceId,
      invoiceNumber: invoice.number,
      kind: reminder.kind,
      scheduledAt: reminder.scheduledAt,
      sentAt: reminder.sentAt,
      status: reminder.status,
      providerMessageId: reminder.providerMessageId,
      error: reminder.error,
    };
  }
}
