#!/usr/bin/env node
/**
 * Platforma-metrike za pilot (S11-7) — čita bazu, ne logove, i ne vraća PII.
 *
 * Odluka za MVP: nema PostHog-a; brojevi se dobijaju iz `audit_log`/tabela.
 * Ovaj skript se pokreće ručno (ili u CI scheduled job-u) na staging/produkciji:
 *
 *   cd apps/api && pnpm metrics:platform
 *
 * Izlaz je JSON (jedan objekat) — bez imena, e-mailova i telefona.
 * "Setup završen" je aproksimiran: firma ima EFD ID i bar jednu poresku stopu
 * (mobile setup se čuva lokalno u SQLite, pa server nema poseban flag).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function lastMonths(count) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(monthKey(date));
  }
  return months;
}

function byMonth(rows, dateField) {
  const result = Object.fromEntries(lastMonths(6).map((month) => [month, 0]));
  for (const row of rows) {
    const value = row[dateField];
    if (!value) continue;
    const key = monthKey(value);
    if (key in result) result[key] += 1;
  }
  return result;
}

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [users, recentUsers, companies, setupCompanies, invoices, payments, reminders] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.company.count(),
      prisma.company.count({
        where: { efdId: { not: null }, taxRates: { some: {} } },
      }),
      prisma.invoice.findMany({
        select: { status: true, issueDate: true, createdAt: true },
      }),
      prisma.payment.findMany({ select: { amountFening: true, paidAt: true } }),
      prisma.reminder.findMany({ select: { status: true, sentAt: true } }),
    ]);

  const issuedInvoices = invoices.filter((invoice) => invoice.status !== 'DRAFT');
  const paidSum = payments.reduce((sum, payment) => sum + payment.amountFening, 0n);

  const report = {
    generatedAt: new Date().toISOString(),
    registrations: {
      usersTotal: users,
      usersLast30Days: recentUsers,
      byMonth: byMonth(await prisma.user.findMany({ select: { createdAt: true } }), 'createdAt'),
    },
    setup: {
      companiesTotal: companies,
      // Proxy za „setup završen“ — vidi zaglavlje skripta.
      companiesWithEfdAndTaxRates: setupCompanies,
    },
    invoices: {
      total: invoices.length,
      issued: issuedInvoices.length,
      byStatus: invoices.reduce((acc, invoice) => {
        acc[invoice.status] = (acc[invoice.status] ?? 0) + 1;
        return acc;
      }, {}),
      issuedByMonth: byMonth(issuedInvoices, 'issueDate'),
    },
    payments: {
      count: payments.length,
      totalFening: paidSum.toString(),
      byMonth: byMonth(payments, 'paidAt'),
    },
    reminders: {
      sent: reminders.filter((reminder) => reminder.status === 'SENT').length,
      failed: reminders.filter((reminder) => reminder.status === 'FAILED').length,
      scheduled: reminders.filter((reminder) => reminder.status === 'SCHEDULED').length,
      sentByMonth: byMonth(
        reminders.filter((reminder) => reminder.status === 'SENT'),
        'sentAt',
      ),
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error('platform-metrics: greška —', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
