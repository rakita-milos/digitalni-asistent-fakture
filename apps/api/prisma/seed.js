/**
 * Seed podaci za razvoj/demo (§12: test podaci — 20 kupaca, 50 faktura).
 *
 * Pokretanje:
 *   pnpm db:seed                    # kreira demo firmu ako ne postoji
 *   SEED_RESET=1 pnpm db:seed       # briše postojeću demo firmu pa je ponovo kreira
 *
 * Demo pristup: demo@digitalni-asistent.ba / DemoLozinka123 (promijeni SEED_OWNER_PASSWORD).
 * Skripta je idempotentna: ako firma sa demo JIB-om postoji, preskače seed.
 */

require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('node:crypto');
const { argon2id, hash } = require('argon2');

const prisma = new PrismaClient();

const DEMO_JIB = '9999999999999';
const DEMO_EMAIL = 'demo@digitalni-asistent.ba';
const DEMO_PHONE = '+38766123000';
const DEMO_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'DemoLozinka123';

const CUSTOMER_SEEDS = [
  'AD Komerc d.o.o.',
  'Banjalučka pivara a.d.',
  'Cemex BiH d.o.o.',
  'Delta elektronika d.o.o.',
  'Elektro Banja Luka d.o.o.',
  'Frizerski salon San',
  'Gradnja Plus d.o.o.',
  'Hemija Prom d.o.o.',
  'Interijer LUX d.o.o.',
  'Jablan auto d.o.o.',
  'Knežević transport s.p.',
  'Lipa market d.o.o.',
  'Metalurg d.o.o.',
  'Nova trgovina d.o.o.',
  'Optika Vid d.o.o.',
  'Pekara Zlatno klasje',
  'Rapid servis d.o.o.',
  'Stolarija Dujić',
  'Tehnomanija BL d.o.o.',
  'Vrtna mehanizacija d.o.o.',
];

const CITIES = [
  'Banja Luka',
  'Sarajevo',
  'Mostar',
  'Bijeljina',
  'Tuzla',
  'Prijedor',
  'Trebinje',
  'Doboj',
  'Zvornik',
  'Gradiška',
];

const ITEM_SEEDS = [
  { name: 'Kabl 3x1.5', unit: 'm', priceFening: 350, taxRateBp: 1700 },
  { name: 'Kabl 3x2.5', unit: 'm', priceFening: 520, taxRateBp: 1700 },
  { name: 'Utičnica', unit: 'kom', priceFening: 900, taxRateBp: 1700 },
  { name: 'Prekidač', unit: 'kom', priceFening: 800, taxRateBp: 1700 },
  { name: 'LED sijalica 10W', unit: 'kom', priceFening: 450, taxRateBp: 1700 },
  { name: 'Radni sat', unit: 'h', priceFening: 2500, taxRateBp: 1700 },
  { name: 'Servis i montaža', unit: 'usluga', priceFening: 5000, taxRateBp: 1700 },
  { name: 'Materijal za ugradnju', unit: 'kom', priceFening: 1200, taxRateBp: 1700 },
  { name: 'Putni trošak', unit: 'km', priceFening: 80, taxRateBp: 0 },
  { name: 'Ostalo', unit: 'kom', priceFening: 1000, taxRateBp: 1700 },
];

const REMINDER_TEMPLATE =
  'Poštovani, račun {broj} u iznosu {iznos} dospijeva {rok}. Molimo izmirenje. Hvala, {firma}.';

function divRoundHalfUp(value, divisor) {
  return (value * 2n + divisor) / (divisor * 2n);
}

function calculateLine(input) {
  const base = divRoundHalfUp(BigInt(input.qtyMilli) * BigInt(input.unitPriceFening), 1000n);
  const discount = divRoundHalfUp(base * BigInt(input.discountBp), 10000n);
  const net = base - discount;
  const tax = divRoundHalfUp(net * BigInt(input.taxRateBp), 10000n);

  return {
    lineSubtotalFening: net,
    lineTaxFening: tax,
    lineTotalFening: net + tax,
  };
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomHex(bytes) {
  return randomBytes(bytes).toString('hex').toUpperCase();
}

function randomJib(index) {
  return `2${String(100000000000 + index).slice(-12)}`;
}

async function removeDemoCompany() {
  const company = await prisma.company.findUnique({ where: { jib: DEMO_JIB } });

  if (!company) {
    return false;
  }

  const users = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { companyId: company.id } });
    await tx.invoice.deleteMany({ where: { companyId: company.id } });
    await tx.device.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
    await tx.user.deleteMany({ where: { companyId: company.id } });
    await tx.customer.deleteMany({ where: { companyId: company.id } });
    await tx.item.deleteMany({ where: { companyId: company.id } });
    await tx.taxRate.deleteMany({ where: { companyId: company.id } });
    await tx.reminderSetting.deleteMany({ where: { companyId: company.id } });
    await tx.subscription.deleteMany({ where: { companyId: company.id } });
    await tx.company.delete({ where: { id: company.id } });
  });

  return true;
}

async function seed() {
  const existing = await prisma.company.findUnique({ where: { jib: DEMO_JIB } });

  if (existing) {
    if (process.env.SEED_RESET !== '1') {
      console.log(`Seed preskočen: demo firma (JIB ${DEMO_JIB}) već postoji.`);
      console.log('Za ponovno kreiranje: SEED_RESET=1 pnpm db:seed');
      return;
    }

    await removeDemoCompany();
    console.log('Postojeća demo firma je obrisana (SEED_RESET=1).');
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });

  const company = await prisma.company.create({
    data: {
      name: 'Demo Firma d.o.o.',
      jib: DEMO_JIB,
      address: 'Kralja Petra I 12',
      city: 'Banja Luka',
      phone: DEMO_PHONE,
      email: DEMO_EMAIL,
      efdId: 'DEMO-EFD-001',
      efdConnectedAt: now,
      numberingPrefix: 'FV',
      numberingYear: currentYear,
      numberingNext: 1,
      numberingNextAdvance: 1,
      defaultDueDays: 15,
    },
  });

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      email: DEMO_EMAIL,
      phone: DEMO_PHONE,
      passwordHash,
      role: 'owner',
      status: 'active',
    },
  });

  await prisma.taxRate.createMany({
    data: [
      { companyId: company.id, name: 'PDV 17%', rateBp: 1700, sufCode: 'PDV17', active: true },
      { companyId: company.id, name: 'PDV 7%', rateBp: 700, sufCode: 'PDV7', active: true },
      { companyId: company.id, name: 'Oslobođeno', rateBp: 0, sufCode: 'PDV0', active: false },
    ],
  });

  const items = [];

  for (const item of ITEM_SEEDS) {
    items.push(
      await prisma.item.create({
        data: {
          companyId: company.id,
          name: item.name,
          unit: item.unit,
          priceFening: BigInt(item.priceFening),
          taxRateBp: item.taxRateBp,
        },
      }),
    );
  }

  const customers = [];

  for (const [index, name] of CUSTOMER_SEEDS.entries()) {
    const city = CITIES[index % CITIES.length];

    customers.push(
      await prisma.customer.create({
        data: {
          companyId: company.id,
          name,
          jib: randomJib(index),
          address: `Ulica ${randomInt(1, 40)}`,
          city,
          phone: `+38766${String(randomInt(100000, 999999))}`,
          email: `kupac${index + 1}@example.ba`,
          note: index % 7 === 0 ? 'Stalni kupac' : null,
        },
      }),
    );
  }

  await prisma.reminderSetting.create({
    data: {
      companyId: company.id,
      enabled: true,
      scheduleJson: [
        { offsetDays: -3, kind: 'sms' },
        { offsetDays: 0, kind: 'sms' },
        { offsetDays: 7, kind: 'sms' },
      ],
      templateJson: { text: REMINDER_TEMPLATE },
    },
  });

  await prisma.subscription.create({
    data: {
      companyId: company.id,
      plan: 'trial',
      status: 'active',
      trialEndsAt: addDays(now, 14),
    },
  });

  let saleNumber = 1;
  let paidCount = 0;
  let partialCount = 0;
  let overdueCount = 0;
  let issuedCount = 0;
  let draftCount = 0;

  for (let index = 0; index < 50; index += 1) {
    const customer = customers[index % customers.length];
    const isDraft = index % 10 === 0;
    const issueDate = addDays(now, -randomInt(0, 120));
    const dueDate = addDays(issueDate, [15, 20, 30][index % 3]);

    const lineCount = randomInt(1, 3);
    const lines = [];

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const item = items[(index + lineIndex) % items.length];
      const qtyMilli = randomInt(1, 8) * 1000;
      const discountBp = index % 4 === 0 ? 500 : 0;
      const calculated = calculateLine({
        qtyMilli,
        unitPriceFening: Number(item.priceFening),
        discountBp,
        taxRateBp: item.taxRateBp,
      });

      lines.push({
        position: lineIndex + 1,
        description: item.name,
        qtyMilli,
        unitPriceFening: item.priceFening,
        discountBp,
        taxRateBp: item.taxRateBp,
        ...calculated,
      });
    }

    const subtotalFening = lines.reduce((sum, line) => sum + line.lineSubtotalFening, 0n);
    const taxFening = lines.reduce((sum, line) => sum + line.lineTaxFening, 0n);
    const totalFening = subtotalFening + taxFening;

    let number;
    let status;
    let paidFening = 0n;
    let fiscalPfr = null;
    let fiscalQrPayload = null;
    let fiscalAt = null;
    let payment = null;

    if (isDraft) {
      number = `DRAFT-${randomHex(4)}`;
      status = 'DRAFT';
      draftCount += 1;
    } else {
      number = `${currentYear}-${String(saleNumber).padStart(4, '0')}`;
      saleNumber += 1;
      issuedCount += 1;
      fiscalPfr = `MOCK-${DEMO_JIB}-${randomHex(6)}`;
      fiscalQrPayload = JSON.stringify({
        pfr: fiscalPfr,
        jib: DEMO_JIB,
        number,
        total: Number(totalFening),
        issuedAt: issueDate.toISOString(),
        mock: true,
      });
      fiscalAt = issueDate;

      if (index % 4 === 0) {
        status = 'PAID';
        paidFening = totalFening;
        payment = { amountFening: totalFening, method: 'TRANSFER' };
        paidCount += 1;
      } else if (index % 4 === 1) {
        status = 'PARTIALLY_PAID';
        paidFening = totalFening / 2n;
        payment = { amountFening: paidFening, method: 'CASH' };
        partialCount += 1;
      } else if (dueDate.getTime() < now.getTime()) {
        status = 'OVERDUE';
        overdueCount += 1;
      } else {
        status = 'ISSUED';
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        number,
        type: 'SALE',
        transactionType: 'SALE',
        status,
        issueDate,
        dueDate,
        currency: 'BAM',
        subtotalFening,
        taxFening,
        totalFening,
        paidFening,
        paymentMethod: payment ? payment.method : null,
        fiscalPfr,
        fiscalQrPayload,
        fiscalAt,
        createdBy: owner.id,
        lines: { create: lines },
      },
    });

    if (payment) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountFening: payment.amountFening,
          method: payment.method,
          paidAt: addDays(issueDate, 3),
          note: 'Seed naplata',
          createdBy: owner.id,
        },
      });
    }

    if (!isDraft) {
      await prisma.fiscalRecord.create({
        data: {
          invoiceId: invoice.id,
          pfr: fiscalPfr,
          qrPayload: fiscalQrPayload,
          status: 'ISSUED',
          esirRequestJson: { mode: 'mock', number },
          esirResponseJson: { status: 'ISSUED', mode: 'mock' },
        },
      });
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { numberingNext: saleNumber },
  });

  console.log('Seed završen.');
  console.log(`  firma:    ${company.name} (JIB ${DEMO_JIB})`);
  console.log(`  korisnik: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  kupci:    ${customers.length}`);
  console.log(`  stavke:   ${items.length}`);
  console.log(
    `  fakture:  50 (draft ${draftCount}, izdate ${issuedCount}, plaćene ${paidCount}, djelimično ${partialCount}, dospjele ${overdueCount})`,
  );
}

seed()
  .catch((error) => {
    console.error('Seed nije uspio:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
