#!/usr/bin/env node
/**
 * Sedmični izvještaj pilota (G14) — spaja platform-metrike i tabelu kohorte.
 *
 *   pnpm pilot:weekly -- --metrics=metrics.json        # iz fajla (preporučeno na stagingu)
 *   pnpm pilot:weekly -- --run                          # pokreće `pnpm --filter api metrics:platform`
 *   pnpm pilot:weekly -- --example --dry-run            # primjer bez PII, ispis na stdout
 *
 * Izlaz: `docs/pilot/reports/<godina>-W<sedmica>.md` + `.json` (JSON je snapshot za Δ sljedeće
 * sedmice). Izvještaj ne sadrži PII — samo agregate i `id` učesnika kroz status kriterije.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { computeStatus, formatBam, formatStatus, isoWeek, pct, readTracking, statusMarkdown } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HELP = `pilot:weekly — sedmični izvještaj pilota

Opcije:
  --metrics=<putanja>   JSON iz \`pnpm --filter api metrics:platform\`
  --run                  pokreni metrics:platform i koristi njegov izlaz
  --tracking=<putanja>   tabela učesnika (default docs/pilot/tracking.csv)
  --example              primjer: fixtures + tracking.example.csv (bez PII)
  --out=<dir>            izlazni direktorij (default docs/pilot/reports)
  --label=<sufiks>       sufiks fajla, npr. \`example\` → 2026-W48.example.md
  --dry-run              ispiši na stdout, ne piši fajlove
  --json                 ispiši JSON umjesto Markdowna
  --today=YYYY-MM-DD     sedmica/datum za test
  --help
`;

function parseArgs(argv) {
  const options = {
    metrics: null,
    run: false,
    tracking: null,
    example: false,
    out: path.join(root, 'docs/pilot/reports'),
    label: '',
    dryRun: false,
    json: false,
    today: new Date(),
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (arg === '--run') options.run = true;
    else if (arg === '--example') options.example = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--metrics=')) options.metrics = arg.slice('--metrics='.length);
    else if (arg.startsWith('--tracking=')) options.tracking = arg.slice('--tracking='.length);
    else if (arg.startsWith('--out=')) options.out = path.resolve(arg.slice('--out='.length));
    else if (arg.startsWith('--label=')) options.label = arg.slice('--label='.length);
    else if (arg.startsWith('--today=')) {
      const date = new Date(`${arg.slice('--today='.length)}T12:00:00Z`);
      if (!Number.isNaN(date.getTime())) options.today = date;
    } else {
      process.stderr.write(`Nepoznata opcija: ${arg}\n\n${HELP}`);
      process.exit(2);
    }
  }

  if (options.example) {
    options.metrics = path.join(root, 'tools/pilot/fixtures/metrics-example.json');
    options.tracking = path.join(root, 'docs/pilot/tracking.example.csv');
    if (!options.label) options.label = 'example';
  }

  return options;
}

function readJson(file) {
  const raw = readFileSync(file, 'utf8').trim();
  return JSON.parse(raw);
}

function loadMetrics(options) {
  if (options.metrics) {
    return { metrics: readJson(path.resolve(options.metrics)), source: path.basename(options.metrics) };
  }
  if (!options.run) {
    process.stderr.write(
      'Nedostaje --metrics=<putanja> ili --run.\n' +
        'Na stagingu: pnpm --filter api metrics:platform > metrics.json, pa --metrics=metrics.json\n',
    );
    process.exit(2);
  }

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  let output;
  try {
    // Na Windowsu se `.cmd` ne može pokrenuti bez shell-a (Node ≥ 20).
    output = execFileSync(command, ['--filter', 'api', 'metrics:platform'], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
  } catch (error) {
    process.stderr.write(
      'Ne mogu pokrenuti `pnpm --filter api metrics:platform`.\n' +
        'Provjeri da je pnpm na PATH-u i da je baza dostupna, ili koristi --metrics=<putanja>.\n' +
        `Detalj: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }
  return { metrics: parseMetricsOutput(output), source: 'pnpm --filter api metrics:platform' };
}

/** pnpm ispiše i baner (`> api@0.0.0 metrics:platform …`) prije JSON-a — uzmi od prve `{`. */
function parseMetricsOutput(output) {
  const start = output.indexOf('{');
  if (start === -1) {
    throw new Error(`metrics:platform nije vratio JSON:\n${output.slice(0, 400)}`);
  }
  return JSON.parse(output.slice(start));
}

function loadStatus(options) {
  const file = options.tracking
    ? path.resolve(options.tracking)
    : path.join(root, 'docs/pilot/tracking.csv');

  if (!existsSync(file)) {
    return { status: null, file: null, errors: ['tracking.csv nije nađen — kohorta nije uključena.'] };
  }

  const { rows, errors } = readTracking(readFileSync(file, 'utf8'));
  if (errors.length > 0) return { status: null, file, errors };

  return { status: computeStatus(rows, { today: options.today }), file, errors: [] };
}

function findPrevious(outDir, week) {
  if (!existsSync(outDir)) return null;
  const snapshots = readdirSync(outDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const candidates = snapshots.filter((file) => file !== `${week}.json` && !file.startsWith(`${week}.`));
  if (candidates.length === 0) return null;
  try {
    return readJson(path.join(outDir, candidates[candidates.length - 1]));
  } catch {
    return null;
  }
}

function delta(current, previous, pick) {
  if (previous === null || previous === undefined || current === null || current === undefined) {
    return '—';
  }
  const diff = Number(current) - Number(previous);
  if (!Number.isFinite(diff)) return '—';
  return diff === 0 ? '0' : `${diff > 0 ? '+' : ''}${diff}`;
}

function metricRows(metrics, previous) {
  const p = previous?.metrics ?? {};
  return [
    ['Korisnici (ukupno)', metrics.registrations.usersTotal, delta(metrics.registrations.usersTotal, p.registrations?.usersTotal)],
    ['Nove firme (30 dana)', metrics.registrations.companiesLast30Days, delta(metrics.registrations.companiesLast30Days, p.registrations?.companiesLast30Days)],
    ['Firme (ukupno)', metrics.setup.companiesTotal, delta(metrics.setup.companiesTotal, p.setup?.companiesTotal)],
    ['Setup završen (EFD + porezi)', metrics.setup.companiesWithEfdAndTaxRates, delta(metrics.setup.companiesWithEfdAndTaxRates, p.setup?.companiesWithEfdAndTaxRates)],
    ['Fakture (ukupno)', metrics.invoices.total, delta(metrics.invoices.total, p.invoices?.total)],
    ['Fakture izdate', metrics.invoices.issued, delta(metrics.invoices.issued, p.invoices?.issued)],
    ['Naplate (broj)', metrics.payments.count, delta(metrics.payments.count, p.payments?.count)],
    ['Naplate (iznos)', formatBam(metrics.payments.totalFening), '—'],
    ['Podsjetnici poslani', metrics.reminders.sent, delta(metrics.reminders.sent, p.reminders?.sent)],
    ['Podsjetnici neuspjeli', metrics.reminders.failed, delta(metrics.reminders.failed, p.reminders?.failed)],
  ];
}

function actionItems(status) {
  if (!status) return ['Uključiti `docs/pilot/tracking.csv` (kopija šablona) da bi kohorta ušla u izvještaj.'];
  const actions = [];
  const byKey = Object.fromEntries(status.criteria.map((criterion) => [criterion.key, criterion]));

  if (!byKey.cohort.met) {
    actions.push(`Dopuniti kohortu na 12–15 prijavljenih (trenutno ${status.cohort}).`);
  }
  if (!byKey.days.met) {
    actions.push(
      `Nastaviti pilot do 14 dana od prvog onboardinga (trenutno ${status.daysSinceFirstOnboarding}).`,
    );
  }
  if (!byKey.unaided.met) {
    actions.push(
      `Izdavanje bez pomoći ${pct(status.unaidedPct)} → pratiti gdje zapinju i pretvoriti u UX/bug zadatke.`,
    );
  }
  if (!byKey.reminder.met) {
    actions.push('Podsjetnici ispod 50 % → pokazati slanje na onboarding pozivu i provjeriti opt-out kupce.');
  }
  if (!byKey.nps.met) {
    actions.push('NPS ispod 30 → poslati upit onima bez odgovora i analizirati kritičare (0–6).');
  }
  if (!byKey.blockers.met) {
    actions.push(`Otvoreni blokatori: ${status.blockers} → P1 fix u 24 h (vidi TRIAGE.md).`);
  }
  if (status.feedbackPct < 100) {
    actions.push(`Feedback ${pct(status.feedbackPct)} → dopuniti za preostale učesnike.`);
  }
  if (status.cohort > 15) {
    actions.push('Kohorta je veća od 15 — za G14 izvještaj koristiti prvih 15 ili proširiti cilj svjesno.');
  }

  return actions.length > 0 ? actions : ['Svi kriteriji G14 su ispunjeni — pokrenuti exit report i odluku.'];
}

export function buildWeeklyReport({
  week,
  generatedAt,
  metrics,
  status,
  previous,
  example = false,
  trackingFile = null,
}) {
  const lines = [];
  lines.push(`# Pilot — sedmični izvještaj (${week})`);
  lines.push('');
  lines.push(
    `> Generisano: ${generatedAt} · Izvor: \`metrics:platform\` + ${
      trackingFile ? `\`${trackingFile}\`` : 'kohorta nije uključena'
    }`,
  );
  if (example) {
    lines.push('>');
    lines.push(
      '> ⚠️ **PRIMJER — sintetički podaci.** Ovo nije stvarni pilot; služi za provjeru formata i alata.',
    );
  }
  lines.push('');

  lines.push('## 1. Platforma (cijela baza)');
  lines.push('');
  lines.push('| Metrika | Vrijednost | Δ sedmica |');
  lines.push('|---|---|---|');
  for (const [label, value, change] of metricRows(metrics, previous)) {
    lines.push(`| ${label} | ${value} | ${change} |`);
  }
  lines.push('');
  lines.push(
    `Fakture po statusu: ${Object.entries(metrics.invoices.byStatus)
      .map(([name, count]) => `${name} ${count}`)
      .join(' · ')}`,
  );
  lines.push('');

  lines.push('## 2. Kohorta (G14)');
  lines.push('');
  if (status) {
    lines.push('```');
    lines.push(formatStatus(status));
    lines.push('```');
    lines.push('');
    lines.push(statusMarkdown(status));
  } else {
    lines.push('Kohorta nije dostupna — `docs/pilot/tracking.csv` nedostaje ili nije ispravan.');
  }
  lines.push('');

  lines.push('## 3. Šta dalje');
  lines.push('');
  for (const action of actionItems(status)) {
    lines.push(`- [ ] ${action}`);
  }
  lines.push('');

  lines.push('## 4. Napomene');
  lines.push('');
  lines.push('- PII (imena, telefoni, firme) ostaje u `docs/pilot/tracking.csv`, koji je u `.gitignore`.');
  lines.push('- Brojevi platforme dolaze iz baze; NPS i „bez pomoći“ samo iz tabele učesnika.');
  lines.push('- Pragovi su iz `PLAN_DALJEG_RADA_v3.md` (G14): 12–15 korisnika, ≥14 dana, ≥70 % / ≥50 %, NPS ≥ 30, 0 blokatora.');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { metrics, source } = loadMetrics(options);
  const { status, file, errors } = loadStatus(options);
  if (errors.length > 0 && !options.example) {
    process.stderr.write(`Napomena: ${errors.join(' ')}\n`);
  }

  const week = isoWeek(options.today);
  const previous = findPrevious(options.out, week);
  const generatedAt = options.today.toISOString().replace('T', ' ').slice(0, 16).replace('T', ' ');
  const markdown = buildWeeklyReport({
    week,
    generatedAt: `${generatedAt} UTC`,
    metrics,
    status,
    previous,
    example: options.example,
    trackingFile: file ? path.relative(root, file).split(path.sep).join('/') : null,
  });

  const payload = {
    week,
    generatedAt: options.today.toISOString(),
    example: options.example,
    source,
    metrics,
    status,
    previousWeek: previous?.week ?? null,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (options.dryRun || options.example) {
    process.stdout.write(`${markdown}\n`);
  }

  if (!options.dryRun) {
    mkdirSync(options.out, { recursive: true });
    const suffix = options.label ? `.${options.label}` : '';
    const mdFile = path.join(options.out, `${week}${suffix}.md`);
    const jsonFile = path.join(options.out, `${week}${suffix}.json`);
    writeFileSync(mdFile, `${markdown}\n`, 'utf8');
    writeFileSync(jsonFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write(`Izvještaj: ${path.relative(root, mdFile)}\n`);
    process.stdout.write(`Snapshot: ${path.relative(root, jsonFile)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
