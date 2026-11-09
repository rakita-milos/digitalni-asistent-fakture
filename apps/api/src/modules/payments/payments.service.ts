import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreatePaymentInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { toInvoiceDetailDto, toPaymentDto } from '../invoices/invoice-mapper';

const PAYABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /invoices/:id/payments — puna ili djelimična naplata (§7.8). */
  async create(companyId: string, userId: string, invoiceId: string, input: CreatePaymentInput) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    if (!PAYABLE_STATUSES.includes(invoice.status as (typeof PAYABLE_STATUSES)[number])) {
      throw new ConflictException('Naplata je moguća samo za izdatu fakturu');
    }

    const remaining = invoice.totalFening - invoice.paidFening;
    const amount = BigInt(input.amountFening);

    // §7.8: paid_fening ≤ total_fening (preplata/kredit kupca nije modelovan u §5).
    if (amount > remaining) {
      throw new BadRequestException({
        message: [
          `Iznos prelazi ostatak duga (${(Number(remaining) / 100).toFixed(2)} KM)`,
        ],
      });
    }

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amountFening: amount,
          method: input.method,
          paidAt,
          note: input.note ?? null,
          createdBy: userId,
        },
      });

      const paidFening = invoice.paidFening + amount;
      const status = paidFening === invoice.totalFening ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidFening, status },
        include: {
          customer: { select: { id: true, name: true } },
          lines: { orderBy: { position: 'asc' } },
          payments: { orderBy: { paidAt: 'desc' } },
        },
      });

      // §21: audit log za naplatu.
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'payment.create',
          entity: 'invoice',
          entityId: invoiceId,
          metaJson: { amountFening: input.amountFening, method: input.method },
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    return {
      payment: toPaymentDto(result.payment),
      invoice: toInvoiceDetailDto(result.invoice),
    };
  }
}
