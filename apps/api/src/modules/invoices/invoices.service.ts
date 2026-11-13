import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type {
  CreateInvoiceInput,
  InvoiceLineInput,
  InvoiceListQuery,
  RefundInvoiceInput,
  SendInvoiceInput,
  UpdateInvoiceInput,
} from '@digitalni-asistent/shared';
import {
  emailSchema,
  formatDraftNumber,
  formatInvoiceNumber,
  phoneSchema,
} from '@digitalni-asistent/shared';

import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { SmsService } from '../auth/sms.service';
import type { FiscalAdapter, FiscalInvoiceData, FiscalResult } from '../fiscal/fiscal.types';
import { FISCAL_ADAPTER } from '../fiscal/fiscal.types';
import {
  calculateInvoiceTotals,
  calculateLines,
  type CalculatedInvoiceLine,
  type InvoiceTotals,
} from './invoice-calculator';
import { toInvoiceDetailDto, toInvoiceSummaryDto } from './invoice-mapper';
import { InvoicePdfService } from './invoice-pdf.service';
import { createPdfLinkToken } from './pdf-link';

const detailInclude = {
  customer: { select: { id: true, name: true } },
  lines: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidAt: 'desc' } },
} satisfies Prisma.InvoiceInclude;

type FiscalizableInvoice = Prisma.InvoiceGetPayload<{
  include: { customer: true; lines: true; company: true };
}>;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FISCAL_ADAPTER) private readonly fiscal: FiscalAdapter,
    private readonly pdf: InvoicePdfService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  /** POST /invoices — kreira DRAFT fakturu (§6). `id` se koristi za offline sync (klijentski UUID v7). */
  async create(companyId: string, userId: string, input: CreateInvoiceInput, id?: string) {
    await this.ensureCustomer(companyId, input.customerId);

    const lines = calculateLines(input.lines);
    const totals = calculateInvoiceTotals(lines);

    const invoice = await this.prisma.invoice.create({
      data: {
        ...(id ? { id } : {}),
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
    if (!env.FEATURE_FISCAL_ENABLED) {
      throw new ServiceUnavailableException('Fiskalizacija je privremeno isključena');
    }

    const invoice = await this.loadForFiscalization(companyId, invoiceId);

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

    const updated = await this.fiscalize(invoice, userId);
    return toInvoiceDetailDto(updated);
  }

  /**
   * POST /invoices/:id/send — šalje fakturu e-mailom (PDF u prilogu) ili SMS-om (kratkotrajni PDF link) — §6.
   * Dozvoljeno samo za izdate dokumente; DRAFT/PENDING_FISCAL/CANCELLED se odbijaju.
   */
  async send(companyId: string, userId: string, invoiceId: string, input: SendInvoiceInput) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    const sendableStatuses = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
    if (!sendableStatuses.includes(invoice.status)) {
      throw new ConflictException('Faktura se može poslati samo nakon izdavanja');
    }

    const fallback = input.channel === 'EMAIL' ? invoice.customer.email : invoice.customer.phone;
    const recipientInput = (input.to ?? fallback ?? '').trim();
    if (!recipientInput) {
      throw new BadRequestException(
        input.channel === 'EMAIL'
          ? 'Kupac nema e-mail — unesite primaoca'
          : 'Kupac nema telefon — unesite primaoca',
      );
    }

    let recipient: string;
    try {
      recipient =
        input.channel === 'EMAIL' ? emailSchema.parse(recipientInput) : phoneSchema.parse(recipientInput);
    } catch {
      throw new BadRequestException(
        input.channel === 'EMAIL'
          ? 'Neispravan e-mail primalac'
          : 'Telefon mora biti u formatu +387XXXXXXXX',
      );
    }

    const amount = `${(Number(invoice.totalFening) / 100).toFixed(2).replace('.', ',')} ${invoice.currency}`;
    const linkTtlSeconds = env.PDF_LINK_TTL_SECONDS;
    const link = `${env.PUBLIC_API_URL}/public/invoices/${invoice.id}/pdf?t=${encodeURIComponent(
      createPdfLinkToken(invoice.id),
    )}`;

    if (input.channel === 'EMAIL') {
      const pdf = await this.pdf.render(companyId, invoice.id);
      await this.email.send({
        to: recipient,
        subject: `Faktura ${invoice.number} — ${amount}`,
        text: [
          'Poštovani,',
          '',
          `u prilogu je faktura ${invoice.number} na ${amount}.`,
          '',
          'Digitalni Asistent',
        ].join('\n'),
        html: [
          '<p>Poštovani,</p>',
          `<p>u prilogu je faktura <strong>${invoice.number}</strong> na ${amount}.</p>`,
          '<p>Digitalni Asistent</p>',
        ].join(''),
        attachments: [
          {
            filename: `faktura-${invoice.number}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      });
    } else {
      const minutes = Math.round(linkTtlSeconds / 60);
      await this.sms.send(
        recipient,
        `Digitalni Asistent: faktura ${invoice.number} na ${amount}. PDF: ${link} (link važi ${minutes} min)`,
      );
    }

    // §21: audit log za slanje fakture (kanal i primalac, bez sadržaja poruke).
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'invoice.send',
        entity: 'invoice',
        entityId: invoice.id,
        metaJson: toJson({
          channel: input.channel,
          to: recipient,
          number: invoice.number,
        }),
      },
    });

    this.logger.log(`Faktura ${invoice.number} poslana (${input.channel}) na ${recipient}`);
    return { sent: true, channel: input.channel, to: recipient };
  }

  /**
   * POST /invoices/:id/convert — M-09: draft PRAČUN (ADVANCE) postaje draft račun (SALE).
   * Tip se mijenja u mjestu da se ne duplira dokument; broj se i dalje dodjeljuje pri izdavanju.
   */
  async convert(companyId: string, userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, type: true, status: true },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (invoice.type !== 'ADVANCE') {
      throw new ConflictException('Samo PRAČUN se može konvertovati u račun');
    }
    if (invoice.status !== 'DRAFT') {
      throw new ConflictException('Konverzija je moguća samo za draft PRAČUN');
    }

    const converted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { type: 'SALE' },
        include: detailInclude,
      });

      // §21: audit log za konverziju PRAČUNA u račun.
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'invoice.convert',
          entity: 'invoice',
          entityId: invoiceId,
          metaJson: toJson({ from: 'ADVANCE', to: 'SALE' }),
        },
      });

      return updated;
    });

    return toInvoiceDetailDto(converted);
  }

  /**
   * Retry za PENDING_FISCAL (BullMQ worker). Vraća null ako faktura nije u PENDING_FISCAL.
   * Backoff (1m/5m/15m/1h/6h) računa worker; ovdje se samo ponavlja fiskalizacija.
   */
  async retryPendingFiscal(companyId: string, invoiceId: string) {
    if (!env.FEATURE_FISCAL_ENABLED) {
      throw new ServiceUnavailableException('Fiskalizacija je privremeno isključena');
    }

    const invoice = await this.loadForFiscalization(companyId, invoiceId);

    if (!invoice || invoice.status !== 'PENDING_FISCAL') {
      return null;
    }

    const updated = await this.fiscalize(invoice, invoice.createdBy);
    this.logger.log(`Fiskalizacija ponovljena za ${invoice.id}: ${updated.number}`);
    return toInvoiceDetailDto(updated);
  }

  private loadForFiscalization(companyId: string, invoiceId: string) {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, lines: { orderBy: { position: 'asc' } }, company: true },
    });
  }

  private async fiscalize(invoice: FiscalizableInvoice, userId: string | null) {
    const companyId = invoice.companyId;

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

    return this.prisma.$transaction(async (tx) => {
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

      // §7.9: kupac sa opt-out-om ne dobija automatske podsjetnike.
      if (!invoice.customer.reminderOptOut) {
        await this.scheduleReminders(tx, invoice.id, invoice.dueDate, companyId);
      }

      return invoiceUpdated;
    });
  }

  /**
   * POST /invoices/:id/cancel — poništenje (§7.6).
   * Novi VOID zapis sa referencom na original; original ostaje, ali prelazi u CANCELLED.
   */
  async cancel(companyId: string, userId: string, invoiceId: string) {
    const original = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { lines: true },
    });

    if (!original) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (original.transactionType !== 'SALE') {
      throw new ConflictException('Storno dokument se ne može poništiti');
    }
    if (original.paidFening > 0n) {
      throw new ConflictException('Faktura sa naplatom se ne poništava — koristite refundaciju');
    }
    if (!['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(original.status)) {
      throw new ConflictException('Poništiti se može samo izdata faktura');
    }

    const voidDocument = await this.prisma.$transaction(async (tx) => {
      const number = await this.allocateNumber(tx, companyId, original.type);

      const created = await tx.invoice.create({
        data: {
          companyId,
          customerId: original.customerId,
          number,
          type: original.type,
          transactionType: 'VOID',
          status: 'CANCELLED',
          issueDate: new Date(),
          dueDate: new Date(),
          currency: original.currency,
          subtotalFening: original.subtotalFening,
          taxFening: original.taxFening,
          totalFening: original.totalFening,
          paidFening: 0n,
          note: `Storno računa ${original.number}`,
          originalInvoiceId: original.id,
          createdBy: userId,
          lines: {
            create: original.lines.map((line) => ({
              position: line.position,
              description: line.description,
              qtyMilli: line.qtyMilli,
              unitPriceFening: line.unitPriceFening,
              discountBp: line.discountBp,
              taxRateBp: line.taxRateBp,
              lineSubtotalFening: line.lineSubtotalFening,
              lineTaxFening: line.lineTaxFening,
              lineTotalFening: line.lineTotalFening,
            })),
          },
        },
        include: detailInclude,
      });

      await tx.invoice.update({
        where: { id: original.id },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'invoice.cancel',
          entity: 'invoice',
          entityId: original.id,
          metaJson: toJson({ voidInvoiceId: created.id, number }),
        },
      });

      return created;
    });

    return toInvoiceDetailDto(voidDocument);
  }

  /**
   * POST /invoices/:id/refund — refundacija (§7.7).
   * Novi REFUND zapis sa referencom; iznos ≤ naplaćeno (i ≤ original).
   */
  async refund(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: RefundInvoiceInput,
  ) {
    const original = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!original) {
      throw new NotFoundException('Faktura nije pronađena');
    }
    if (original.transactionType !== 'SALE') {
      throw new ConflictException('Refundacija se veže samo na originalnu fakturu');
    }

    const refundable = original.paidFening;
    if (refundable <= 0n) {
      throw new ConflictException('Nema naplaćenih sredstava za refundaciju');
    }

    const amount = BigInt(input.amountFening);

    const refundDocument = await this.prisma.$transaction(async (tx) => {
      const alreadyRefunded = await tx.invoice.aggregate({
        where: { originalInvoiceId: original.id, transactionType: 'REFUND' },
        _sum: { totalFening: true },
      });
      const refunded = alreadyRefunded._sum.totalFening ?? 0n;

      if (refunded + amount > refundable) {
        throw new BadRequestException({
          message: [
            `Refundacija prelazi naplaćeni iznos (preostalo ${((Number(refundable) - Number(refunded)) / 100).toFixed(2)} KM)`,
          ],
        });
      }

      const number = await this.allocateNumber(tx, companyId, original.type);

      const created = await tx.invoice.create({
        data: {
          companyId,
          customerId: original.customerId,
          number,
          type: original.type,
          transactionType: 'REFUND',
          status: 'ISSUED',
          issueDate: new Date(),
          dueDate: new Date(),
          currency: original.currency,
          subtotalFening: amount,
          taxFening: 0n,
          totalFening: amount,
          paidFening: 0n,
          note: input.note ?? `Refundacija po računu ${original.number}`,
          originalInvoiceId: original.id,
          createdBy: userId,
          lines: {
            create: [
              {
                position: 1,
                description: `Refundacija po računu ${original.number}`,
                qtyMilli: 1000,
                unitPriceFening: amount,
                discountBp: 0,
                taxRateBp: 0,
                lineSubtotalFening: amount,
                lineTaxFening: 0n,
                lineTotalFening: amount,
              },
            ],
          },
        },
        include: detailInclude,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'invoice.refund',
          entity: 'invoice',
          entityId: original.id,
          metaJson: toJson({ refundInvoiceId: created.id, number, amountFening: input.amountFening }),
        },
      });

      return created;
    });

    return toInvoiceDetailDto(refundDocument);
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
