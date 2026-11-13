import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SmsService } from '../auth/sms.service';
import { formatDate, formatFening, renderTemplate } from '../reminders/reminder-template';
import { ReminderSettingsService } from '../reminders/reminder-settings.service';

const QUEUE_NAME = 'reminders';
const SCAN_EVERY_MS = 60_000;
const BATCH_SIZE = 100;

const SKIP_STATUSES = ['DRAFT', 'CANCELLED', 'PAID'];

function bullConnection(): { host: string; port: number; password?: string; db?: number } {
  const parsed = new URL(env.REDIS_URL);
  const db = parsed.pathname.replace('/', '');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: parsed.password } : {}),
    ...(db ? { db: Number(db) } : {}),
  };
}

/**
 * Šalje automatske podsjetnike (§7.9): redovi `SCHEDULED` čije je vrijeme došlo.
 * Preskače plaćene/poništene/draft fakture i kupce bez telefona.
 */
@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderWorker.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly settings: ReminderSettingsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = bullConnection();

    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(QUEUE_NAME, async () => this.scan(), { connection });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Reminder job ${job?.id ?? '?'} pao: ${error.message}`);
    });

    await this.queue.upsertJobScheduler(
      'reminder-scan',
      { every: SCAN_EVERY_MS },
      { name: 'scan', data: {}, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async scan(): Promise<{ processed: number; sent: number; failed: number }> {
    const due = await this.prisma.reminder.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      include: { invoice: { include: { customer: true, company: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
    });

    let sent = 0;
    let failed = 0;

    for (const reminder of due) {
      const invoice = reminder.invoice;

      if (SKIP_STATUSES.includes(invoice.status)) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'CANCELLED' },
        });
        continue;
      }

      // §7.9: opt-out kupca — podsjetnik se otkazuje, ne šalje.
      if (invoice.customer.reminderOptOut) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: 'CANCELLED',
            error: 'Kupac je odjavio podsjetnike (opt-out)',
          },
        });
        continue;
      }

      if (!invoice.customer.phone) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', error: 'Kupac nema telefon' },
        });
        failed += 1;
        continue;
      }

      const settings = await this.settings.get(invoice.companyId);
      const text = renderTemplate(settings.template.text, {
        broj: invoice.number,
        iznos: formatFening(invoice.totalFening - invoice.paidFening),
        rok: formatDate(invoice.dueDate),
        firma: invoice.company.name,
      });

      try {
        await this.sms.send(invoice.customer.phone, text);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'SENT', sentAt: new Date(), error: null },
        });
        sent += 1;
        // S11-7: metrika automatskih podsjetnika (bez PII).
        this.analytics.track('reminder_sent', {
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          channel: 'sms',
        });
      } catch (error) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', error: (error as Error).message },
        });
        failed += 1;
      }
    }

    if (due.length > 0) {
      this.logger.log(`Podsjetnici: ${due.length} zbirno, ${sent} poslano, ${failed} neuspjelo`);
    }

    return { processed: due.length, sent, failed };
  }
}