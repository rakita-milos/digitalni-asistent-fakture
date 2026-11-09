import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type {
  CreateInvoiceInput,
  InvoiceLineInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from '@digitalni-asistent/shared';
import { formatDraftNumber } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
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
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

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
