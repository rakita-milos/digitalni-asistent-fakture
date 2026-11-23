#!/usr/bin/env node
/**
 * Pilot status (G14) — čita tabelu učesnika i računa kriterije kapije.
 *
 *   pnpm pilot:status                      # docs/pilot/tracking.csv
 *   pnpm pilot:status -- --json            # mašinski čitljiv izlaz
 *   pnpm pilot:status -- --example         # šablon sa 12 primjera (bez PII)
 *   pnpm pilot:status -- --strict          # exit 1 ako G14 nije ispunjen
 *
 * Tabela sadrži PII (ime, telefon, firma) i **nije u gitu**. Izlaz prikazuje samo `id` i agregate.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { computeStatus, formatStatus, readTracking } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HELP = `pilot:status — status pilota i kriteriji G14

Opcije:
  --tracking=<putanja>   tabela učesnika (default docs/pilot/tracking.csv)
  --example              koristi docs/pilot/tracking.example.csv
  --json                 JSON izlaz (bez PII)
  --strict               exit 1 ako kriteriji nisu ispunjeni
  --today=YYYY-MM-DD     “danas” za računanje dana pilota (test/dry-run)
  --help
`;

function parseArgs(argv) {
  const options = {
    tracking: null,
    example: false,
    json: false,
    strict: false,
    today: new Date(),
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (arg === '--example') options.example = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg.startsWith('--tracking=')) options.tracking = arg.slice('--tracking='.length);
    else if (arg.startsWith('--today=')) {
      const date = new Date(`${arg.slice('--today='.length)}T12:00:00Z`);
      if (!Number.isNaN(date.getTime())) options.today = date;
    } else {
      process.stderr.write(`Nepoznata opcija: ${arg}\n\n${HELP}`);
      process.exit(2);
    }
  }

  return options;
}

export function loadTracking(file) {
  const { rows, errors } = readTracking(readFileSync(file, 'utf8'));
  return { rows, errors };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const file = options.tracking
    ? path.resolve(options.tracking)
    : path.join(root, options.example ? 'docs/pilot/tracking.example.csv' : 'docs/pilot/tracking.csv');

  if (!existsSync(file)) {
    process.stderr.write(
      `Tabela nije nađena: ${file}\n` +
        'Kopiraj šablon: docs/pilot/tracking.example.csv → docs/pilot/tracking.csv ' +
        '(PII fajl je u .gitignore).\n',
    );
    process.exit(2);
  }

  const { rows, errors } = loadTracking(file);
  if (errors.length > 0) {
    process.stderr.write(`Tabela nije ispravna:\n- ${errors.join('\n- ')}\n`);
    process.exit(2);
  }

  const status = computeStatus(rows, { today: options.today });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Pilot status — ${file.replace(root + path.sep, '')}\n` +
        `${formatStatus(status)}\n`,
    );
    if (rows.some((row) => row.id === '')) {
      process.stdout.write('Upozorenje: neki redovi nemaju id — preskočeni su.\n');
    }
  }

  if (options.strict && !status.passed) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
