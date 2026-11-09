import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type {
  CreateInvoiceInput,
  InvoiceLineInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from '@digitalni-asistent/shared';
import { formatDraftNumber, formatInvoiceNumber } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
import type { FiscalAdapter, FiscalInvoiceData, FiscalResult } from '../fiscal/fiscal.types';
import { FISCAL_ADAPTER } from '../fiscal/fiscal.types';
import {
  calculateInvoiceTotals,
  calculateLines,
  type CalculatedInvoiceLine,
  type InvoiceTotals,
} from './invoice-calculator';
import { toInvoiceDetailDto, toInvoiceSummaryDto } from './invoice-mapper';

const detailInclude = {
  customer: { select: { id: true, name: true } },
  lines: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidAt: 'desc' } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FISCAL_ADAPTER) private readonly fiscal: FiscalAdapter,
  ) {}

  /** POST /invoices — kreira DRAFT fakturu (§6). */
  async create(companyId: string, userId: string, input: CreateInvoiceInput) {
    await this.ensureCustomer(companyId, input.customerId);

    const lines = calculateLines(input.lines);
    const totals = calculateInvoiceTotals(lines);

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        customerId: input.customerId,
        number: this.createDraftNumber(),
        type: input.type,
        status: 'DRAFT',
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        currency: input.currency,
        subtotalFening: totals.subtotalFening,
        taxFening: totals.taxFening,
        totalFening: totals.totalFening,
        note: input.note ?? null,
        paymentMethod: input.paymentMethod ?? null,
        createdBy: userId,
        lines: { create: lines.map((line) => this.toLineCreate(line)) },
      },
      include: detailInclude,
    });

    return toInvoiceDetailDto(invoice);
  }

  /** GET /invoices — filteri: status, period (issueDate), kupac, broj + paginacija. */
  async list(companyId: string, query: InvoiceListQuery) {
    const where: Prisma.InvoiceWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.from || query.to) {
      where.issueDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.q) {
      where.number = { contains: query.q, mode: 'insensitive' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: { customer: { select: { id: true, name: true } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items: items.map(toInvoiceSummaryDto), total };
  }

  /** GET /invoices/:id — detalj sa linijama. */
  async get(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: detailInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    return toInvoiceDetailDto(invoice);
  }

  /** PATCH /invoices/:id — samo DRAFT (§7.4). */
  async update(companyId: string, id: string, input: UpdateInvoiceInput) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, companyId } });

    if (!existing) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Samo DRAFT faktura se može mijenjati');
    }
    if (input.customerId) {
      await this.ensureCustomer(companyId, input.customerId);
    }

    const data: Prisma.InvoiceUpdateInput = {};

    if (input.customerId) {
      data.customer = { connect: { id: input.customerId } };
    }
    if (input.issueDate) {
      data.issueDate = new Date(input.issueDate);
    }
    if (input.dueDate) {
      data.dueDate = new Date(input.dueDate);
    }
    if (input.currency) {
      data.currency = input.currency;
    }
    if (input.note !== undefined) {
      data.note = input.note;
    }
    if (input.paymentMethod !== undefined) {
      data.paymentMethod = input.paymentMethod;
    }

    if (input.lines) {
      const lines = calculateLines(input.lines);
      const totals = calculateInvoiceTotals(lines);
      data.subtotalFening = totals.subtotalFening;
      data.taxFening = totals.taxFening;
      data.totalFening = totals.totalFening;
      data.lines = { deleteMany: {}, create: lines.map((line) => this.toLineCreate(line)) };
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data,
      include: detailInclude,
    });

    return toInvoiceDetailDto(invoice);
  }

  /**
   * POST /invoices/:id/issue — fiskalizacija i dodjela broja (§4, §7.5).
   * Redoslijed: ESIR odgovor → tek onda ISSUED; ako ESIR padne, faktura ostaje PENDING_FISCAL.
   */
  async issue(companyId: string, userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, lines: { orderBy: { position: 'asc' } }, company: true },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (invoice.status !== 'DRAFT') {
      throw new ConflictException('Samo DRAFT faktura se može izdati');
    }
    if (invoice.type === 'ADVANCE') {
      throw new ConflictException(
        'PRAČUN se ne fiskalizuje — konverzija u fakturu dolazi u Sprintu 4',
      );
    }

    const fiscalData: FiscalInvoiceData = {
      number: invoice.number,
      type: invoice.type,
      issueDate: invoice.issueDate.toISOString(),
      currency: invoice.currency,
      subtotalFening: Number(invoice.subtotalFening),
      taxFening: Number(invoice.taxFening),
      totalFening: Number(invoice.totalFening),
      company: { name: invoice.company.name, jib: invoice.company.jib, efdId: invoice.company.efdId },
      lines: invoice.lines.map((line) => ({
        description: line.description,
        qtyMilli: line.qtyMilli,
        unitPriceFening: Number(line.unitPriceFening),
        taxRateBp: line.taxRateBp,
        lineTotalFening: Number(line.lineTotalFening),
      })),
    };

    let fiscal: FiscalResult;
    try {
      fiscal = await this.fiscal.issue(fiscalData);
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PENDING_FISCAL' },
        });
        await tx.fiscalRecord.create({
          data: {
            invoiceId: invoice.id,
            status: 'FAILED',
            esirRequestJson: toJson(fiscalData),
            esirResponseJson: toJson({ error: (error as Error).message }),
          },
        });
      });
      this.logger.error(`Fiskalizacija nije uspjela za ${invoice.id}: ${(error as Error).message}`);
      throw new HttpException(
        { message: ['Fiskalizacija nije uspjela — faktura je PENDING_FISCAL i biće ponovljena'] },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const number = await this.allocateNumber(tx, companyId, invoice.type);

      const invoiceUpdated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          number,
          status: 'ISSUED',
          fiscalPfr: fiscal.pfr,
          fiscalQrPayload: fiscal.qrPayload,
          fiscalAt: new Date(),
        },
        include: detailInclude,
      });

      await tx.fiscalRecord.create({
        data: {
          invoiceId: invoice.id,
          pfr: fiscal.pfr,
          qrPayload: fiscal.qrPayload,
          esirRequestJson: toJson(fiscal.request),
          esirResponseJson: toJson(fiscal.response),
          status: 'ISSUED',
        },
      });

      // §10 / §21: audit log za izdavanje.
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'invoice.issue',
          entity: 'invoice',
          entityId: invoice.id,
          metaJson: toJson({ number, pfr: fiscal.pfr }),
        },
      });

      await this.scheduleReminders(tx, invoice.id, invoice.dueDate, companyId);

      return invoiceUpdated;
    });

    return toInvoiceDetailDto(updated);
  }

  /** Dodjela broja (§7.1): po firmi i tipu, monotono, bez rupa, reset na 1 svake godine. */
  private async allocateNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    type: 'SALE' | 'ADVANCE',
  ): Promise<string> {
    // Zaključavamo red firme da paralelne fiskalizacije ne uzmu isti broj.
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;

    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    const year = new Date().getUTCFullYear();
    const isNewYear = company.numberingYear !== year;
    const saleNext = isNewYear ? 1 : company.numberingNext;
    const advanceNext = isNewYear ? 1 : company.numberingNextAdvance;
    const sequence = type === 'ADVANCE' ? advanceNext : saleNext;
    const formatted = formatInvoiceNumber(year, sequence);
    const number = company.numberingPrefix ? `${company.numberingPrefix}${formatted}` : formatted;

    await tx.company.update({
      where: { id: companyId },
      data: {
        numberingYear: year,
        numberingNext: type === 'ADVANCE' ? saleNext : sequence + 1,
        numberingNextAdvance: type === 'ADVANCE' ? sequence + 1 : advanceNext,
      },
    });

    return number;
  }

  /** Automatski plan podsjetnika (§7.9) — redovi se kreiraju pri izdavanju, šalje ih worker (Sprint 5). */
  private async scheduleReminders(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    dueDate: Date,
    companyId: string,
  ): Promise<void> {
    const settings = await tx.reminderSetting.findUnique({ where: { companyId } });
    if (!settings?.enabled) {
      return;
    }

    const schedule = settings.scheduleJson as unknown;
    if (!Array.isArray(schedule)) {
      return;
    }

    for (const entry of schedule.slice(0, 4)) {
      const item = entry as { offsetDays?: unknown; kind?: unknown };
      if (typeof item.offsetDays !== 'number') {
        continue;
      }

      await tx.reminder.create({
        data: {
          invoiceId,
          kind: typeof item.kind === 'string' ? item.kind : 'sms',
          scheduledAt: new Date(dueDate.getTime() + item.offsetDays * 86_400_000),
          status: 'SCHEDULED',
        },
      });
    }
  }

  private async ensureCustomer(companyId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, archivedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Kupac nije pronađen');
    }
  }

  private createDraftNumber(): string {
    return formatDraftNumber(randomUUID().replace(/-/g, '').slice(0, 10));
  }

  private toLineCreate(line: CalculatedInvoiceLine) {
    return {
      position: line.position,
      description: line.description,
      qtyMilli: line.qtyMilli,
      unitPriceFening: line.unitPriceFening,
      discountBp: line.discountBp,
      taxRateBp: line.taxRateBp,
      lineSubtotalFening: line.lineSubtotalFening,
      lineTaxFening: line.lineTaxFening,
      lineTotalFening: line.lineTotalFening,
    };
  }
}

export type { InvoiceLineInput, InvoiceTotals };

/** Prisma JSON ne prima Date/undefined — normalizujemo kroz JSON round-trip. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
