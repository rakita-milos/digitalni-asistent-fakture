#!/usr/bin/env node
/**
 * Pilot dry-run (T0−3) — prolazi kroz onboarding tok za dvije **sintetičke** firme preko API-ja:
 * registracija → EFD/numeracija → porez → artikal → kupac → faktura (2 stavke) → izdavanje →
 * PDF → naplata → podsjetnik → setup-complete.
 *
 *   pnpm pilot:dryrun -- --api-url=http://127.0.0.1:3001
 *
 * Mjeri trajanje svakog koraka i piše izvještaj u `docs/pilot/reports/DRYRUN-<datum>.md`.
 * Podaci su izmišljeni (DRYRUN firme, example.ba); skripta na kraju pokušava DELETE /account.
 * Ako je brisanje isključeno (`FEATURE_ACCOUNT_DELETION=false`), ostaju sintetički podaci —
 * lokalnu bazu očisti sa `SEED_RESET=1 pnpm db:seed`.
 *
 * Nije zamjena za pravi onboarding (UI, telefon, korisnik); dokazuje da backend tok i mjerenje rade.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HELP = `pilot:dryrun — sintetički onboarding kroz API

  --api-url=<url>   default http://127.0.0.1:3001
  --json            JSON izlaz
  --no-write        ne piši izvještaj u docs/pilot/reports
  --no-cleanup      ne briši sintetičke naloge
  --help
`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const apiUrl = (
  args.find((arg) => arg.startsWith('--api-url='))?.split('=')[1] ?? 'http://127.0.0.1:3001'
).replace(/\/+$/, '');
const json = args.includes('--json');
const noWrite = args.includes('--no-write');
const noCleanup = args.includes('--no-cleanup');

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const today = new Date();
const steps = [];
const firms = [];

async function request(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

function assertOk(result, expected, label) {
  const status = result.response.status;
  if (!expected.includes(status)) {
    throw new Error(
      `${label}: HTTP ${status} ${JSON.stringify(result.payload).slice(0, 300)}`,
    );
  }
}

async function step(firm, name, fn) {
  const started = performance.now();
  try {
    const detail = await fn();
    steps.push({ firm, name, ms: Math.round(performance.now() - started), ok: true, detail });
    return detail;
  } catch (error) {
    steps.push({
      firm,
      name,
      ms: Math.round(performance.now() - started),
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function makeFirm(index) {
  const suffix = `${stamp.slice(-8)}${index}`;
  return {
    index,
    jib: `9${suffix.padStart(12, '0').slice(-12)}`,
    email: `dryrun-${stamp}-${index}@example.ba`,
    phone: `+38761${String(Date.now()).slice(-5)}${index}`.slice(0, 12),
    password: 'DryRunLozinka123',
    name: `DRYRUN Firma ${index}`,
    token: '',
    companyId: '',
    customerId: '',
    invoiceId: '',
  };
}

async function runFirm(firm) {
  const t0 = performance.now();

  await step(firm.index, 'registracija firme i vlasnika', async () => {
    const result = await request('/auth/register', {
      method: 'POST',
      body: {
        company: {
          name: firm.name,
          jib: firm.jib,
          address: 'DRYRUN ulica 1',
          city: 'Banja Luka',
          phone: firm.phone,
          email: firm.email,
          defaultDueDays: 15,
        },
        owner: { email: firm.email, phone: firm.phone, password: firm.password },
      },
    });
    assertOk(result, [201, 200], 'registracija');
    if (!result.payload?.accessToken) throw new Error('registracija: nema accessToken');
    firm.token = result.payload.accessToken;
    firm.companyId = result.payload.company?.id ?? '';
    return `firma ${result.payload.company?.name ?? '—'}`;
  });

  await step(firm.index, 'EFD i numeracija (PATCH /company)', async () => {
    const result = await request('/company', {
      method: 'PATCH',
      token: firm.token,
      body: { efdId: `DRYRUN-EFD-${firm.index}`, numberingPrefix: 'DR-', defaultDueDays: 15 },
    });
    assertOk(result, [200], 'PATCH /company');
    return 'EFD postavljen';
  });

  await step(firm.index, 'poreska stopa', async () => {
    const result = await request('/tax-rates', {
      method: 'POST',
      token: firm.token,
      body: { name: 'PDV 17 %', rateBp: 1700, sufCode: '17', active: true },
    });
    assertOk(result, [201, 200], 'POST /tax-rates');
    return 'PDV 17 %';
  });

  await step(firm.index, 'artikal/usluga', async () => {
    const result = await request('/items', {
      method: 'POST',
      token: firm.token,
      body: { name: 'DRYRUN usluga', unit: 'kom', priceFening: 5000, taxRateBp: 1700 },
    });
    assertOk(result, [201, 200], 'POST /items');
    return 'artikal kreiran';
  });

  await step(firm.index, 'kupac', async () => {
    const result = await request('/customers', {
      method: 'POST',
      token: firm.token,
      body: {
        name: `DRYRUN Kupac ${firm.index}`,
        city: 'Banja Luka',
        phone: `+38765${String(firm.index).padStart(6, '0')}`,
        email: `dryrun-kupac-${stamp}-${firm.index}@example.ba`,
      },
    });
    assertOk(result, [201, 200], 'POST /customers');
    firm.customerId = result.payload?.id ?? '';
    if (!firm.customerId) throw new Error('kupac: nema id');
    return 'kupac kreiran';
  });

  await step(firm.index, 'faktura sa 2 stavke (draft)', async () => {
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + 15 * 86400000);
    const result = await request('/invoices', {
      method: 'POST',
      token: firm.token,
      headers: undefined,
      body: {
        customerId: firm.customerId,
        type: 'SALE',
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        currency: 'BAM',
        note: 'DRYRUN — sintetička faktura',
        lines: [
          { description: 'DRYRUN usluga', qtyMilli: 2000, unitPriceFening: 5000, taxRateBp: 1700, discountBp: 0 },
          { description: 'DRYRUN materijal', qtyMilli: 1000, unitPriceFening: 2500, taxRateBp: 1700, discountBp: 0 },
        ],
      },
    });
    assertOk(result, [201, 200], 'POST /invoices');
    firm.invoiceId = result.payload?.id ?? '';
    if (!firm.invoiceId) throw new Error('faktura: nema id');
    return `draft ${result.payload.number}`;
  });

  let issuedTotalFening = 0;
  await step(firm.index, 'izdavanje (mock fiskalizacija)', async () => {
    const result = await request(`/invoices/${firm.invoiceId}/issue`, {
      method: 'POST',
      token: firm.token,
    });
    assertOk(result, [200, 201], 'issue');
    if (result.payload?.status !== 'ISSUED') throw new Error(`status ${result.payload?.status}`);
    if (!result.payload?.fiscalPfr) throw new Error('nema PFR');
    issuedTotalFening = Number(result.payload.totalFening ?? 0);
    return `broj ${result.payload.number}, PFR ${String(result.payload.fiscalPfr).slice(0, 4)}…`;
  });

  await step(firm.index, 'PDF sa QR-om', async () => {
    const response = await fetch(`${apiUrl}/invoices/${firm.invoiceId}/pdf`, {
      headers: { authorization: `Bearer ${firm.token}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
    if (![200, 302].includes(response.status)) throw new Error(`PDF HTTP ${response.status}`);
    if (response.status === 200) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0, 4).toString() !== '%PDF') throw new Error('nije PDF');
      return `${bytes.length} B`;
    }
    return '302 signed URL';
  });

  await step(firm.index, 'djelimična naplata', async () => {
    const amount = Math.max(1, Math.floor(issuedTotalFening / 2));
    const result = await request(`/invoices/${firm.invoiceId}/payments`, {
      method: 'POST',
      token: firm.token,
      body: { amountFening: amount, method: 'CASH', note: 'DRYRUN naplata' },
    });
    assertOk(result, [201, 200], 'POST payments');
    return `${(amount / 100).toFixed(2)} KM`;
  });

  await step(firm.index, 'ručni podsjetnik (SMS log)', async () => {
    const result = await request(`/invoices/${firm.invoiceId}/remind`, {
      method: 'POST',
      token: firm.token,
    });
    assertOk(result, [200, 201], 'POST remind');
    return 'podsjetnik poslan';
  });

  await step(firm.index, 'setup-complete', async () => {
    const result = await request('/company/setup-complete', { method: 'POST', token: firm.token });
    assertOk(result, [200, 201], 'setup-complete');
    return 'setup označen';
  });

  firm.timeToFirstInvoiceMs = Math.round(performance.now() - t0);
  firms.push(firm);
}

async function cleanup(firm) {
  try {
    const result = await request('/account', {
      method: 'DELETE',
      token: firm.token,
      body: { confirmation: 'OBRISI' },
    });
    return result.response.status === 200 || result.response.status === 204;
  } catch {
    return false;
  }
}

function buildReport() {
  const ok = steps.every((item) => item.ok);
  const lines = [];
  lines.push(`# Pilot dry-run — ${today.toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('> **SINTETIČKI PODACI.** Dvije izmišljene firme (DRYRUN, example.ba) kroz API tok;');
  lines.push('> nije pravi onboarding (bez UI/telefona/korisnika). Služi kao T0−3 provjera.');
  lines.push(`> API: \`${apiUrl}\` · komanda: \`pnpm pilot:dryrun\``);
  lines.push('');
  lines.push('## Rezultat po koracima');
  lines.push('');
  lines.push('| Firma | Korak | ms | Status | Detalj |');
  lines.push('|---|---|---|---|---|');
  for (const item of steps) {
    lines.push(`| ${item.firm} | ${item.name} | ${item.ms} | ${item.ok ? '✅' : '❌'} | ${item.detail ?? ''} |`);
  }
  lines.push('');
  lines.push('## Vrijeme do prve izdate fakture');
  lines.push('');
  for (const firm of firms) {
    lines.push(`- Firma ${firm.index}: **${((firm.timeToFirstInvoiceMs ?? 0) / 1000).toFixed(1)} s**`);
  }
  lines.push('');
  lines.push(`**Ukupno:** ${steps.length} koraka, ${steps.filter((s) => s.ok).length} uspješno, ` +
    `${steps.filter((s) => !s.ok).length} palo.`);
  lines.push('');
  lines.push('## Napomene');
  lines.push('');
  lines.push('- Vrijeme uključuje mrežu i API obračun, ne UI unos; cilj „< 30 s“ mjeri se na telefonu.');
  lines.push('- Ako je `FEATURE_ACCOUNT_DELETION` isključen, sintetički nalozi ostaju — očisti sa `SEED_RESET=1 pnpm db:seed`.');
  lines.push('- Rezultat ne zamjenjuje pravi onboarding niti Play/uređaj test.');
  lines.push('');
  return { markdown: lines.join('\n'), ok };
}

async function main() {
  process.stdout.write(`Pilot dry-run: ${apiUrl}\n`);

  const health = await request('/health');
  if (health.response.status !== 200 || health.payload?.status !== 'ok') {
    throw new Error(`health nije ok: HTTP ${health.response.status}`);
  }

  for (const index of [1, 2]) {
    const firm = makeFirm(index);
    await runFirm(firm);
  }

  let cleaned = 0;
  if (!noCleanup) {
    for (const firm of firms) {
      if (await cleanup(firm)) cleaned += 1;
    }
  }

  const { markdown, ok } = buildReport();
  const summary = {
    ok,
    apiUrl,
    steps,
    firms: firms.map((firm) => ({
      id: firm.index,
      companyId: firm.companyId,
      timeToFirstInvoiceMs: firm.timeToFirstInvoiceMs,
    })),
    cleanedAccounts: cleaned,
  };

  if (!noWrite) {
    const dir = path.join(root, 'docs/pilot/reports');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `DRYRUN-${today.toISOString().slice(0, 10)}.md`);
    writeFileSync(file, `${markdown}\n`, 'utf8');
    process.stdout.write(`Izvještaj: ${path.relative(root, file)}\n`);
  }

  if (json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    for (const item of steps) {
      process.stdout.write(
        `${item.ok ? '✓' : '✗'} [${item.firm}] ${item.name} (${item.ms} ms)${item.ok ? '' : ` — ${item.detail}`}\n`,
      );
    }
    process.stdout.write(
      `\n${ok ? 'OK' : 'PAO'}: ${steps.filter((s) => s.ok).length}/${steps.length} koraka; ` +
        `obrisano naloga: ${cleaned}/${firms.length}\n`,
    );
  }

  if (!ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`pilot:dryrun greška — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
