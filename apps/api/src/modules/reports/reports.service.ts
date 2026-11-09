import { Injectable } from '@nestjs/common';

import type {
  MonthlyReportQuery,
  ReceivablesQuery,
} from '@digitalni-asistent/shared';
import { RECEIVABLES_BUCKETS } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 86_400_000;

const OUTSTANDING_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /reports/receivables — aging potraživanja (§6). */
  async receivables(companyId: string, query: ReceivablesQuery) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, status: { in: [...OUTSTANDING_STATUSES] } },
      select: { id: true, totalFening: true, paidFening: true, dueDate: true },
    });

    const buckets = RECEIVABLES_BUCKETS.map((key) => ({
      key,
      count: 0,
      amountFening: 0,
    }));

    let totalOutstandingFening = 0;
    let invoiceCount = 0;

    for (const invoice of invoices) {
      const outstanding = Number(invoice.totalFening - invoice.paidFening);
      if (outstanding <= 0) {
        continue;
      }

      totalOutstandingFening += outstanding;
      invoiceCount += 1;

      const daysOverdue = Math.floor((asOf.getTime() - invoice.dueDate.getTime()) / DAY_MS);
      const index =
        daysOverdue <= 0 ? 0 : daysOverdue <= 30 ? 1 : daysOverdue <= 60 ? 2 : daysOverdue <= 90 ? 3 : 4;

      const bucket = buckets[index];
      if (bucket) {
        bucket.count += 1;
        bucket.amountFening += outstanding;
      }
    }

    return {
      asOf: asOf.toISOString(),
      buckets,
      totalOutstandingFening,
      invoiceCount,
    };
  }

  /** GET /reports/monthly — mjesečni izvještaj (§6). */
  async monthly(companyId: string, query: MonthlyReportQuery) {
    const year = query.year ?? new Date().getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const [invoices, payments] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          issueDate: { gte: start, lt: end },
          status: { notIn: ['DRAFT', 'CANCELLED'] },
        },
        select: { issueDate: true, totalFening: true },
      }),
      this.prisma.payment.findMany({
        where: { paidAt: { gte: start, lt: end }, invoice: { companyId } },
        select: { paidAt: true, amountFening: true },
      }),
    ]);

    const months = Array.from({ length: 12 }, (_value, index) => ({
      month: index + 1,
      issuedCount: 0,
      invoicedFening: 0,
      paidFening: 0,
    }));

    for (const invoice of invoices) {
      const month = months[invoice.issueDate.getUTCMonth()];
      if (month) {
        month.issuedCount += 1;
        month.invoicedFening += Number(invoice.totalFening);
      }
    }

    for (const payment of payments) {
      const month = months[payment.paidAt.getUTCMonth()];
      if (month) {
        month.paidFening += Number(payment.amountFening);
      }
    }

    return { year, months };
  }
}
