import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type {
  SyncOperation,
  SyncOperationResult,
  SyncPullQuery,
  SyncPushInput,
} from '@digitalni-asistent/shared';
import {
  createCustomerSchema,
  createInvoiceSchema,
  updateCustomerSchema,
} from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { toInvoiceSummaryDto } from '../invoices/invoice-mapper';
import { InvoicesService } from '../invoices/invoices.service';

type ApplyResult = 'applied' | 'duplicate';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * POST /sync/push — batch offline operacija (§6).
   * Idempotencija: `entityId` (klijentski UUID v7) + `sync_queue` zapis po uređaju.
   */
  async push(
    companyId: string,
    userId: string,
    deviceId: string | undefined,
    input: SyncPushInput,
  ) {
    const device = deviceId ?? 'unknown';
    const results: SyncOperationResult[] = [];

    for (const operation of input.operations) {
      const alreadyApplied = await this.prisma.syncQueue.findFirst({
        where: {
          deviceId: device,
          entity: operation.entity,
          entityId: operation.entityId,
          op: operation.op,
          status: 'DONE',
        },
      });

      if (alreadyApplied) {
        results.push({
          entity: operation.entity,
          entityId: operation.entityId,
          status: 'duplicate',
        });
        continue;
      }

      try {
        const status = await this.apply(companyId, userId, operation);
        await this.prisma.syncQueue.create({
          data: {
            deviceId: device,
            entity: operation.entity,
            entityId: operation.entityId,
            op: operation.op,
            payloadJson: toJson(operation.payload),
            status: 'DONE',
          },
        });
        results.push({ entity: operation.entity, entityId: operation.entityId, status });
      } catch (error) {
        const message = this.errorMessage(error);
        await this.prisma.syncQueue
          .create({
            data: {
              deviceId: device,
              entity: operation.entity,
              entityId: operation.entityId,
              op: operation.op,
              payloadJson: toJson(operation.payload),
              status: 'FAILED',
            },
          })
          .catch(() => undefined);

        this.logger.warn(`Sync operacija ${operation.entity}/${operation.entityId} nije primijenjena: ${message}`);
        results.push({
          entity: operation.entity,
          entityId: operation.entityId,
          status: 'failed',
          error: message,
        });
      }
    }

    return { results, serverTime: new Date().toISOString() };
  }

  /** GET /sync/pull — delta za uređaj (§6). Kupci nemaju `updatedAt`, pa se vraćaju svi aktivni. */
  async pull(companyId: string, query: SyncPullQuery) {
    const since = query.since ? new Date(query.since) : undefined;

    const customers = await this.prisma.customer.findMany({
      where: { companyId, archivedAt: null },
      orderBy: { name: 'asc' },
    });

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        ...(since ? { updatedAt: { gt: since } } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });

    return {
      serverTime: new Date().toISOString(),
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        jib: customer.jib,
        vatId: customer.vatId,
        address: customer.address,
        city: customer.city,
        phone: customer.phone,
        email: customer.email,
        note: customer.note,
        archivedAt: customer.archivedAt,
      })),
      invoices: invoices.map(toInvoiceSummaryDto),
    };
  }

  private async apply(
    companyId: string,
    userId: string,
    operation: SyncOperation,
  ): Promise<ApplyResult> {
    if (operation.entity === 'customer') {
      if (operation.op === 'create') {
        const parsed = createCustomerSchema.parse(operation.payload);
        const existing = await this.prisma.customer.findFirst({
          where: { id: operation.entityId, companyId },
          select: { id: true },
        });
        if (existing) {
          return 'duplicate';
        }
        await this.customers.create(companyId, parsed, operation.entityId);
        return 'applied';
      }

      const parsed = updateCustomerSchema.parse(operation.payload);
      await this.customers.update(companyId, operation.entityId, parsed);
      return 'applied';
    }

    if (operation.op !== 'create') {
      throw new Error('Izmjena fakture kroz sync nije podržana');
    }

    const parsed = createInvoiceSchema.parse(operation.payload);
    const existing = await this.prisma.invoice.findFirst({
      where: { id: operation.entityId, companyId },
      select: { id: true },
    });
    if (existing) {
      return 'duplicate';
    }

    await this.invoices.create(companyId, userId, parsed, operation.entityId);
    return 'applied';
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as { issues?: Array<{ message?: string }> }).issues;
      return issues?.[0]?.message ?? 'Neispravan payload';
    }
    return error instanceof Error ? error.message : 'Nepoznata greška';
  }
}
