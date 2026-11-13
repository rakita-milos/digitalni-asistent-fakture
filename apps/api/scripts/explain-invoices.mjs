#!/usr/bin/env node
/**
 * EXPLAIN provjera za listu faktura i aging (Pre-Deployment Checklist C2 / S11-1).
 *
 * Pravi dijagnosticki dataset koji lici na produkciju (vise firmi, po 500 faktura),
 * pokrece EXPLAIN (ANALYZE, BUFFERS) nad tri topla upita i pada (exit 1) ako plan
 * sadrzi 'Seq Scan' na tabeli invoices.
 *
 *   cd apps/api && pnpm db:explain
 *   cd apps/api && pnpm db:explain --keep   # ne brise dijagnosticke firme
 *
 * Dijagnosticke firme imaju JIB EXPLAINJIB* i brisu se na kraju (osim --keep).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DIAGNOSTIC_COMPANIES = 40;
const INVOICES_PER_COMPANY = 500;
const JIB_PREFIX = 'EXPLAINJIB';
const KEEP = process.argv.includes('--keep');
const prisma = new PrismaClient();

async function ensureDiagnosticDataset() {
  const existing = await prisma.company.count({ where: { jib: { startsWith: JIB_PREFIX } } });
  if (existing >= DIAGNOSTIC_COMPANIES) {
    return;
  }
  console.log(
    'Priprema ' +
      DIAGNOSTIC_COMPANIES +
      ' firmi x ' +
      INVOICES_PER_COMPANY +
      ' faktura (postoji ' +
      existing +
      ')...',
  );
  for (let companyIndex = existing; companyIndex < DIAGNOSTIC_COMPANIES; companyIndex += 1) {
    const suffix = String(companyIndex).padStart(7, '0');
    const company = await prisma.company.create({
      data: {
        name: 'EXPLAIN firma ' + companyIndex,
        jib: JIB_PREFIX + suffix,
        address: 'EXPLAIN 1',
        city: 'Banja Luka',
        phone: '+38765000000',
        email: 'explain' + companyIndex + '@example.invalid',
        numberingPrefix: 'EX',
        numberingYear: 2026,
        numberingNext: 1,
        defaultDueDays: 15,
      },
    });
    const customer = await prisma.customer.create({
      data: { companyId: company.id, name: 'EXPLAIN kupac' },
    });
    const since = Date.now() - 400 * 86400000;
    const rows = Array.from({ length: INVOICES_PER_COMPANY }, (_, index) => {
      const issueDate = new Date(since + (index % 400) * 86400000);
      const total = 10000 + (index % 50000);
      const tax = Math.round(total * 0.17);
      const status = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'][index % 5];
      return {
        companyId: company.id,
        customerId: customer.id,
        number: 'EXPLAIN-' + index,
        type: 'SALE',
        status,
        issueDate,
        createdAt: issueDate,
        dueDate: new Date(issueDate.getTime() + 15 * 86400000),
        currency: 'BAM',
        subtotalFening: BigInt(total),
        taxFening: BigInt(tax),
        totalFening: BigInt(total + tax),
        paidFening: status === 'PAID' ? BigInt(total + tax) : 0n,
      };
    });
    for (let offset = 0; offset < rows.length; offset += 500) {
      await prisma.invoice.createMany({ data: rows.slice(offset, offset + 500) });
    }
  }
}

const QUERIES = [
  {
    name: 'lista faktura (stranica 1)',
    sql:
      'SELECT id, number, status, total_fening, paid_fening, due_date ' +
      'FROM invoices WHERE company_id = $1::uuid ' +
      'ORDER BY created_at DESC LIMIT 20',
  },
  {
    name: 'aging po statusu',
    sql:
      'SELECT status, COUNT(*), SUM(total_fening - paid_fening) ' +
      'FROM invoices WHERE company_id = $1::uuid ' +
      "AND status IN ('ISSUED','SENT','PARTIALLY_PAID','OVERDUE') GROUP BY status",
  },
  {
    name: 'dospjela potrazivanja (aging lista)',
    sql:
      'SELECT id, due_date, total_fening - paid_fening ' +
      'FROM invoices WHERE company_id = $1::uuid ' +
      "AND status IN ('ISSUED','SENT','PARTIALLY_PAID','OVERDUE') " +
      'AND due_date < now() ORDER BY due_date ASC LIMIT 20',
  },
];

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { jib: { startsWith: JIB_PREFIX } },
    select: { id: true },
  });
  const ids = companies.map((company) => company.id);
  if (ids.length === 0) {
    return 0;
  }
  await prisma.invoice.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { companyId: { in: ids } } });
  const deleted = await prisma.company.deleteMany({ where: { id: { in: ids } } });
  return deleted.count;
}

async function main() {
  await ensureDiagnosticDataset();
  await prisma.$executeRawUnsafe('ANALYZE "invoices"');

  const company = await prisma.company.findFirst({
    where: { jib: { startsWith: JIB_PREFIX } },
    orderBy: { jib: 'asc' },
  });
  if (!company) {
    throw new Error('Dijagnosticki dataset nije napravljen.');
  }

  const total = await prisma.invoice.count({ where: { companyId: company.id } });
  const grandTotal = await prisma.invoice.count();
  console.log('Firma u planu: ' + company.name + ' (' + company.id + ') - faktura: ' + total);
  console.log('Ukupno faktura u bazi: ' + grandTotal);
  console.log('');

  let seqScans = 0;
  for (const query of QUERIES) {
    const rows = await prisma.$queryRawUnsafe(
      'EXPLAIN (ANALYZE, BUFFERS) ' + query.sql,
      company.id,
    );
    const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
    console.log('=== ' + query.name + ' ===');
    console.log(plan);
    console.log('');
    if (/Seq Scan on "?invoices"?/i.test(plan)) {
      seqScans += 1;
      console.error('FAIL: Seq Scan na invoices u upitu: ' + query.name);
    }
  }

  if (!KEEP) {
    const deleted = await cleanup();
    console.log('Ocisceno dijagnostickih firmi: ' + deleted);
  }

  if (seqScans > 0) {
    console.error('EXPLAIN: ' + seqScans + ' upit(a) ima Seq Scan - dodati indeks kroz migraciju.');
    process.exitCode = 1;
    return;
  }
  console.log('EXPLAIN: svi upiti koriste indekse (nema Seq Scan na invoices).');
}

main()
  .catch((error) => {
    console.error(
      'EXPLAIN provjera nije uspjela -',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
