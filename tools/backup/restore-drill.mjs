#!/usr/bin/env node
/**
 * Restore drill (T12-8) — vraća dump u praznu bazu, poredi brojeve i mjeri trajanje.
 *
 * Lokalno (PostgreSQL u Dockeru):
 *   pnpm backup:restore-drill -- --dump=.tools/backups/backup-2026-11-23T....dump \
 *     --docker=digitalni-postgres --user=digitalni --db=digitalni_asistent
 *
 * Staging (prazna baza, npr. Neon branch):
 *   RESTORE_DATABASE_URL=postgresql://... \
 *   pnpm backup:restore-drill -- --dump=backup.dump --restore-url="$RESTORE_DATABASE_URL" \
 *     --source-url="$STAGING_DATABASE_URL" --yes
 *
 * Sigurnosna pravila:
 *  - restore baza mora sadržavati "restore", "drill" ili "staging" u imenu;
 *  - ne smije biti ista kao izvorna baza, `postgres` ni template baze;
 *  - staging restore traži `--yes` (nema slučajnog brisanja).
 *
 * Cilj: RTO < 30 min; skripta pada ako je sporije ili se brojevi ne poklapaju.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COUNT_SQL,
  assertSafeRestoreDatabase,
  dockerPgRestore,
  dockerPsql,
  nowStamp,
  parseCounts,
  parseDatabaseUrl,
  run,
} from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HELP = `backup:restore-drill — restore + provjera integriteta

  --dump=<fajl>          dump za restore (obavezno)
  --docker=<kontejner>   lokalni restore kroz docker exec
  --user/--db            docker korisnik i izvorna baza
  --restore-url=<url>    staging: prazna baza za restore
  --source-url=<url>     staging: izvor za poređenje (default DATABASE_URL)
  --max-seconds=<n>      dozvoljeno trajanje restore-a (default 1800)
  --no-drop              ostavi lokalnu restore bazu (za debug)
  --yes                  potvrda za staging restore
  --json
  --help
`;

function parseArgs(argv) {
  const options = {
    dump: null,
    docker: null,
    user: process.env.BACKUP_DB_USER ?? 'digitalni',
    database: process.env.BACKUP_DB_NAME ?? 'digitalni_asistent',
    restoreUrl: null,
    sourceUrl: process.env.DATABASE_URL ?? null,
    maxSeconds: 1800,
    drop: true,
    yes: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (arg === '--no-drop') options.drop = false;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--dump=')) options.dump = path.resolve(arg.slice('--dump='.length));
    else if (arg.startsWith('--docker=')) options.docker = arg.slice('--docker='.length);
    else if (arg.startsWith('--user=')) options.user = arg.slice('--user='.length);
    else if (arg.startsWith('--db=')) options.database = arg.slice('--db='.length);
    else if (arg.startsWith('--restore-url=')) options.restoreUrl = arg.slice('--restore-url='.length);
    else if (arg.startsWith('--source-url=')) options.sourceUrl = arg.slice('--source-url='.length);
    else if (arg.startsWith('--max-seconds=')) options.maxSeconds = Number(arg.slice('--max-seconds='.length));
    else {
      process.stderr.write(`Nepoznata opcija: ${arg}\n\n${HELP}`);
      process.exit(2);
    }
  }
  return options;
}

function psqlBinary(url, sql) {
  const config = parseDatabaseUrl(url);
  return run('psql', [url, '-At', '-F', '|', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: config.password },
  });
}

function diffCounts(source, restored) {
  const keys = [...new Set([...Object.keys(source), ...Object.keys(restored)])].sort();
  return keys.map((table) => ({
    table,
    source: source[table] ?? 0,
    restored: restored[table] ?? 0,
    ok: (source[table] ?? 0) === (restored[table] ?? 0),
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dump || !existsSync(options.dump)) {
    process.stderr.write('Nedostaje --dump=<fajl> ili fajl ne postoji.\n');
    process.exit(2);
  }

  const dump = readFileSync(options.dump);
  const startedAt = Date.now();
  const temporaryDb = `da_restore_${nowStamp().replace(/-/g, '').toLowerCase()}`;
  let sourceCounts;
  let restoredCounts;
  let dropped = false;

  const output = (message) => {
    if (!options.json) process.stdout.write(`${message}\n`);
  };

  if (options.docker) {
    output(`Restore drill: Docker ${options.docker}, izvor "${options.database}" → "${temporaryDb}"`);

    try {
      sourceCounts = parseCounts(dockerPsql(options.docker, options.user, options.database, COUNT_SQL));
    } catch (error) {
      throw new Error(`Ne mogu pročitati izvornu bazu: ${error.message}`);
    }

    run('docker', [
      'exec',
      options.docker,
      'psql',
      '-U',
      options.user,
      '-d',
      'postgres',
      '-c',
      `CREATE DATABASE "${temporaryDb}"`,
    ]);

    try {
      dockerPgRestore(options.docker, options.user, temporaryDb, dump);
      restoredCounts = parseCounts(dockerPsql(options.docker, options.user, temporaryDb, COUNT_SQL));
    } finally {
      if (options.drop) {
        try {
          run('docker', [
            'exec',
            options.docker,
            'psql',
            '-U',
            options.user,
            '-d',
            'postgres',
            '-c',
            `DROP DATABASE IF EXISTS "${temporaryDb}"`,
          ]);
          dropped = true;
        } catch {
          output('Upozorenje: restore baza nije obrisana.');
        }
      }
    }
  } else if (options.restoreUrl) {
    if (!options.yes) {
      process.stderr.write('Staging restore traži --yes (i praznu bazu).\n');
      process.exit(2);
    }
    const restore = parseDatabaseUrl(options.restoreUrl);
    const source = options.sourceUrl ? parseDatabaseUrl(options.sourceUrl) : null;
    assertSafeRestoreDatabase(restore.database, source?.database);

    output(`Restore drill: staging "${restore.database}" (izvor: ${source?.database ?? 'nije dat'})`);

    if (source) sourceCounts = parseCounts(psqlBinary(options.sourceUrl, COUNT_SQL));

    run('pg_restore', [options.restoreUrl, '--clean', '--if-exists', '--no-owner', '--no-acl'], {
      env: { ...process.env, PGPASSWORD: restore.password },
    });
    restoredCounts = parseCounts(psqlBinary(options.restoreUrl, COUNT_SQL));
  } else {
    process.stderr.write('Nedostaje --docker=<kontejner> ili --restore-url=<url>.\n');
    process.exit(2);
  }

  const durationSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
  const rows = sourceCounts ? diffCounts(sourceCounts, restoredCounts) : [];
  const mismatches = rows.filter((row) => !row.ok);
  const tooSlow = durationSeconds > options.maxSeconds;

  if (!options.json) {
    if (rows.length > 0) {
      output('\n| Tabela | Izvor | Restore | Status |');
      output('|---|---|---|---|');
      for (const row of rows) {
        output(`| ${row.table} | ${row.source} | ${row.restored} | ${row.ok ? '✅' : '❌'} |`);
      }
    }
    output(`\nTrajanje: ${durationSeconds} s (limit ${options.maxSeconds} s)`);
    output(`Restore baza: ${dropped ? 'obrisana' : options.drop ? 'nije obrisana' : 'ostavljena'}`);
  }

  const result = {
    ok: mismatches.length === 0 && !tooSlow,
    mode: options.docker ? 'docker' : 'staging',
    durationSeconds,
    maxSeconds: options.maxSeconds,
    temporaryDb: options.docker ? temporaryDb : null,
    dropped,
    rows,
    mismatches: mismatches.map((row) => row.table),
  };

  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.stderr.write(
      `\nRestore drill NIJE prošao: ${mismatches.length} tabela se ne poklapa, ` +
        `${tooSlow ? 'prekoračen limit trajanja' : 'trajanje u limitu'}.\n`,
    );
    process.exit(1);
  }
  output('\nRestore drill prošao.');
}

main().catch((error) => {
  process.stderr.write(`restore-drill greška — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
