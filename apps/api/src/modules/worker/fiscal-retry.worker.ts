import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { fiscalRetryDelayMinutes } from './fiscal-backoff';

const QUEUE_NAME = 'fiscal-retry';
const SCAN_EVERY_MS = 300_000;
const BATCH_SIZE = 50;
const ALARM_AFTER_MS = 3 * 86_400_000;

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
 * Ponavlja fiskalizaciju za PENDING_FISCAL fakture (§7.5 backoff 1m/5m/15m/1h/6h).
 * Alarmira ako faktura čeka duže od 3 dana (zakon dopušta 5).
 */
@Injectable()
export class FiscalRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FiscalRetryWorker.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = bullConnection();

    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(QUEUE_NAME, async () => this.scan(), { connection });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Fiscal retry job ${job?.id ?? '?'} pao: ${error.message}`);
    });

    await this.queue.upsertJobScheduler(
      'fiscal-retry-scan',
      { every: SCAN_EVERY_MS },
      { name: 'scan', data: {}, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async scan(): Promise<{ processed: number; retried: number; succeeded: number }> {
    const pending = await this.prisma.invoice.findMany({
      where: { status: 'PENDING_FISCAL' },
      include: { fiscalRecords: { orderBy: { createdAt: 'desc' } } },
      take: BATCH_SIZE,
    });

    let retried = 0;
    let succeeded = 0;

    for (const invoice of pending) {
      const waitingMs = Date.now() - invoice.updatedAt.getTime();
      if (waitingMs > ALARM_AFTER_MS) {
        this.logger.error(
          `ALARM: faktura ${invoice.id} čeka fiskalizaciju ${Math.round(waitingMs / 86_400_000)} dana`,
        );
      }

      const failedRecords = invoice.fiscalRecords.filter(
        (record) => record.status === 'FAILED',
      );
      const failedAttempts = failedRecords.length;
      const delayMinutes = fiscalRetryDelayMinutes(failedAttempts);

      if (delayMinutes === null) {
        continue;
      }

      // Backoff se računa od zadnjeg NEUSPJELOG pokušaja (ne od uspješnog zapisa).
      const lastAttempt = failedRecords[0]?.createdAt;
      if (lastAttempt && Date.now() - lastAttempt.getTime() < delayMinutes * 60_000) {
        continue;
      }

      retried += 1;
      try {
        const result = await this.invoices.retryPendingFiscal(invoice.companyId, invoice.id);
        if (result) {
          succeeded += 1;
        }
      } catch (error) {
        this.logger.warn(`Retry fiskalizacije nije uspio za ${invoice.id}: ${(error as Error).message}`);
      }
    }

    if (pending.length > 0) {
      this.logger.log(`Fiskalni retry: ${pending.length} čeka, ${retried} pokušano, ${succeeded} uspjelo`);
    }

    return { processed: pending.length, retried, succeeded };
  }
}
