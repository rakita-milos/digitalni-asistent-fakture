#!/usr/bin/env node
/**
 * Samoprovjera pilotskih alata (G14) — bez baze i bez PII.
 *
 *   pnpm pilot:selftest
 *
 * Provjerava: CSV parser, računanje kriterija G14, NPS formulu, generisanje izvještaja i to
 * da izlaz ne sadrži PII iz primjera.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeStatus, formatStatus, isoWeek, parseCsv, readTracking } from './lib.mjs';
import { buildWeeklyReport } from './weekly.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TODAY = new Date('2026-11-23T12:00:00.000Z');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  process.stdout.write(`✓ ${name}\n`);
}

check('CSV parser poštuje navodnike i zareze u polju', () => {
  const rows = parseCsv('a,b\n"x, y",z\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], ['x, y', 'z']);
});

check('primjer tabele daje očekivane agregate', () => {
  const text = readFileSync(path.join(root, 'docs/pilot/tracking.example.csv'), 'utf8');
  const { rows, errors } = readTracking(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 12);

  const status = computeStatus(rows, { today: TODAY });
  assert.equal(status.cohort, 12);
  assert.equal(status.onboarded, 10);
  assert.equal(status.unaided, 8);
  assert.equal(status.unaidedPct, 66.7);
  assert.equal(status.reminders, 7);
  assert.equal(status.reminderPct, 58.3);
  assert.equal(status.feedback, 9);
  assert.equal(status.nps.promoters, 4);
  assert.equal(status.nps.detractors, 3);
  assert.equal(status.nps.score, 11);
  assert.equal(status.blockers, 1);
  assert.equal(status.daysSinceFirstOnboarding, 20);
  assert.equal(status.passed, false);
  assert.equal(status.criteria.filter((criterion) => criterion.met).length, 3);
});

check('kohorta koja ispunjava sve kriterije prolazi G14', () => {
  const header =
    'id,company,contact,phone,device,invited_at,onboarded_at,unaided_invoice,first_invoice_seconds,reminder_sent,feedback_at,nps,blocker_open,notes';
  const row = (index) =>
    `P${index},Pilot ${index},—,—,Android,2026-10-20,2026-11-01,da,30,da,2026-11-10,10,ne,`;
  const text = [header, ...Array.from({ length: 12 }, (_, index) => row(index + 1))].join('\n');

  const { rows, errors } = readTracking(text);
  assert.deepEqual(errors, []);

  const status = computeStatus(rows, { today: TODAY });
  assert.equal(status.passed, true);
  assert.equal(status.nps.score, 100);
  assert.equal(status.unaidedPct, 100);
  assert.equal(status.reminderPct, 100);
  assert.equal(status.blockers, 0);
  assert.ok(status.criteria.every((criterion) => criterion.met));
});

check('status ispis ne sadrži naziv firme ni kontakt', () => {
  const text = readFileSync(path.join(root, 'docs/pilot/tracking.example.csv'), 'utf8');
  const { rows } = readTracking(text);
  const output = formatStatus(computeStatus(rows, { today: TODAY }));
  assert.ok(!output.includes('Pilot 01'));
  assert.ok(!output.includes('@'));
});

check('sedmični izvještaj ima obavezne sekcije i oznaku primjera', () => {
  const metrics = JSON.parse(
    readFileSync(path.join(root, 'tools/pilot/fixtures/metrics-example.json'), 'utf8'),
  );
  const { rows } = readTracking(
    readFileSync(path.join(root, 'docs/pilot/tracking.example.csv'), 'utf8'),
  );
  const status = computeStatus(rows, { today: TODAY });

  const report = buildWeeklyReport({
    week: isoWeek(TODAY),
    generatedAt: TODAY.toISOString(),
    metrics,
    status,
    previous: null,
    example: true,
    trackingFile: 'docs/pilot/tracking.example.csv',
  });

  assert.ok(report.includes('⚠️ **PRIMJER'));
  assert.ok(report.includes('## 1. Platforma'));
  assert.ok(report.includes('## 2. Kohorta (G14)'));
  assert.ok(report.includes('## 3. Šta dalje'));
  assert.ok(report.includes('Kapija G14'));
  assert.ok(report.includes('12.845,00 KM'));
  assert.ok(!report.includes('Pilot 01'));
  assert.ok(!report.includes('@'));
});

process.stdout.write(`\nOK: ${checks} provjera.\n`);
