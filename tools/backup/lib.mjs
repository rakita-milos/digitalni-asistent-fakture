/**
 * Zajedničke funkcije za backup/restore alate (T12-8).
 * Bez zavisnosti osim Node-a i `pg_dump`/`pg_restore` (ili Docker kontejnera).
 */

import { execFileSync } from 'node:child_process';

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  });
}

/** Parsira DATABASE_URL u dijelove; baca grešku ako nije postgres URL. */
export function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL nije PostgreSQL URL.');
  }
  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
  };
}

/** SQL koji vraća broj redova po tabelama — isti skup za izvor i restore. */
export const COUNT_SQL = `
SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'items', count(*) FROM items
UNION ALL SELECT 'tax_rates', count(*) FROM tax_rates
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'invoice_lines', count(*) FROM invoice_lines
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'reminders', count(*) FROM reminders
UNION ALL SELECT 'fiscal_records', count(*) FROM fiscal_records
UNION ALL SELECT 'audit_log', count(*) FROM audit_log
ORDER BY 1;
`;

/** Parsira izlaz psql `-At -F '|'` u objekat tabela → broj. */
export function parseCounts(output) {
  const counts = {};
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [table, value] = line.split('|');
    if (table) counts[table] = Number(value);
  }
  return counts;
}

export function dockerPsql(container, user, database, sql) {
  return run('docker', ['exec', container, 'psql', '-U', user, '-d', database, '-At', '-F', '|', '-c', sql], {
    encoding: 'utf8',
  });
}

export function dockerPgDump(container, user, database) {
  return run('docker', ['exec', container, 'pg_dump', '-U', user, '-d', database, '-Fc', '--no-owner', '--no-acl']);
}

export function dockerPgRestoreList(container, dumpBuffer) {
  return run('docker', ['exec', '-i', container, 'pg_restore', '-l'], { input: dumpBuffer, encoding: 'utf8' });
}

export function dockerPgRestore(container, user, database, dumpBuffer) {
  return run(
    'docker',
    ['exec', '-i', container, 'pg_restore', '-U', user, '-d', database, '--no-owner', '--no-acl', '--clean', '--if-exists'],
    { input: dumpBuffer, encoding: 'utf8' },
  );
}

/** Ime baze za restore drill; nikad ne smije biti izvorna baza. */
export function assertSafeRestoreDatabase(name, sourceName) {
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw new Error(`Nesigurno ime baze: ${name}`);
  }
  if (name === sourceName || ['postgres', 'template0', 'template1'].includes(name)) {
    throw new Error(`Restore u "${name}" je zabranjen.`);
  }
  if (!/(restore|drill|staging)/i.test(name)) {
    throw new Error('Ime restore baze mora sadržavati "restore", "drill" ili "staging".');
  }
}

export function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
