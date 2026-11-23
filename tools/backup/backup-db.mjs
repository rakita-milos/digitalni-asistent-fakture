#!/usr/bin/env node
/**
 * Dnevni backup baze (T12-8) — `pg_dump -Fc`, opciono upload na Cloudflare R2.
 *
 *   # lokalno, PostgreSQL u Dockeru (bez pg_dump na hostu)
 *   pnpm backup:db -- --docker=digitalni-postgres --user=digitalni --db=digitalni_asistent
 *
 *   # staging/produkcija, pg_dump na hostu
 *   pnpm backup:db -- --url="$DATABASE_URL" --out=/var/backups/da --upload
 *
 * Opcije:
 *   --docker=<kontejner>   dump kroz `docker exec` (lokalno)
 *   --url=<DATABASE_URL>   dump kroz `pg_dump` (staging/produkcija)
 *   --user/--db            kredencijali za docker režim (default iz URL-a ili digitalni)
 *   --out=<dir>            izlazni direktorij (default .tools/backups)
 *   --keep=<dana>          briše lokalne dumpove starije od N dana (default 30, 0 = ne briši)
 *   --upload               upload na R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)
 *   --json                 mašinski čitljiv izlaz
 *
 * Nikad ne ispisuje lozinke ni puni DATABASE_URL.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nowStamp, run } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HELP = `backup:db — pg_dump (+ R2 upload)

  --docker=<kontejner>  dump kroz docker exec (lokalno)
  --url=<DATABASE_URL>  dump kroz pg_dump
  --user=<user>         docker korisnik (default digitalni)
  --db=<database>       docker baza (default digitalni_asistent)
  --out=<dir>           izlazni direktorij (default .tools/backups)
  --keep=<dana>         retencija lokalnih dumpova (default 30)
  --upload              upload na R2
  --json
  --help
`;

function parseArgs(argv) {
  const options = {
    docker: null,
    url: process.env.DATABASE_URL ?? null,
    user: process.env.BACKUP_DB_USER ?? 'digitalni',
    database: process.env.BACKUP_DB_NAME ?? 'digitalni_asistent',
    out: path.join(root, '.tools/backups'),
    keep: 30,
    upload: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (arg === '--upload') options.upload = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--docker=')) options.docker = arg.slice('--docker='.length);
    else if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
    else if (arg.startsWith('--user=')) options.user = arg.slice('--user='.length);
    else if (arg.startsWith('--db=')) options.database = arg.slice('--db='.length);
    else if (arg.startsWith('--out=')) options.out = path.resolve(arg.slice('--out='.length));
    else if (arg.startsWith('--keep=')) options.keep = Number(arg.slice('--keep='.length));
    else {
      process.stderr.write(`Nepoznata opcija: ${arg}\n\n${HELP}`);
      process.exit(2);
    }
  }
  return options;
}

function log(options, message) {
  if (!options.json) process.stdout.write(`${message}\n`);
}

async function uploadToR2(file, key) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 upload traži R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY i R2_BUCKET.');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: readFileSync(file),
      ContentType: 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    }),
  );
  return key;
}

function prune(options) {
  if (!Number.isFinite(options.keep) || options.keep <= 0 || !existsSync(options.out)) return [];
  const cutoff = Date.now() - options.keep * 86400000;
  const removed = [];
  for (const name of readdirSync(options.out)) {
    if (!/^backup-.*\.dump$/.test(name)) continue;
    const file = path.join(options.out, name);
    if (statSync(file).mtimeMs < cutoff) {
      unlinkSync(file);
      removed.push(name);
    }
  }
  return removed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.docker && !options.url) {
    process.stderr.write('Nedostaje --docker=<kontejner> ili --url=<DATABASE_URL>.\n');
    process.exit(2);
  }
  if (options.docker && options.url) {
    process.stderr.write('Koristi ili --docker ili --url, ne oboje.\n');
    process.exit(2);
  }

  mkdirSync(options.out, { recursive: true });
  const name = `backup-${nowStamp()}.dump`;
  const file = path.join(options.out, name);
  const startedAt = Date.now();

  log(options, `Backup: ${options.docker ? `docker:${options.docker}` : 'pg_dump'} → ${path.relative(root, file)}`);
  const dump = options.docker
    ? run('docker', ['exec', options.docker, 'pg_dump', '-U', options.user, '-d', options.database, '-Fc', '--no-owner', '--no-acl'])
    : run('pg_dump', [options.url, '-Fc', '--no-owner', '--no-acl']);

  writeFileSync(file, dump);
  const size = statSync(file).size;
  if (size < 1024) throw new Error(`Dump je sumnjivo mali (${size} B).`);

  const list = options.docker
    ? run('docker', ['exec', '-i', options.docker, 'pg_restore', '-l'], { input: dump, encoding: 'utf8' })
    : run('pg_restore', ['-l', file], { encoding: 'utf8' });
  const entries = list.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith(';')).length;
  if (entries === 0) throw new Error('Dump nema nijedan objekat (pg_restore -l je prazan).');

  const result = {
    ok: true,
    file: path.relative(root, file),
    bytes: size,
    entries,
    durationMs: Date.now() - startedAt,
    uploaded: null,
    pruned: [],
    mode: options.docker ? 'docker' : 'pg_dump',
  };

  if (options.upload) {
    const key = `backups/db/${name}`;
    result.uploaded = await uploadToR2(file, key);
    log(options, `Upload: r2://${process.env.R2_BUCKET}/${key}`);
  }

  result.pruned = prune(options);
  log(options, `OK: ${(size / 1024).toFixed(1)} KB, ${entries} objekata, ${result.durationMs} ms.`);
  if (result.pruned.length > 0) log(options, `Obrisano po retenciji: ${result.pruned.length}`);

  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`backup:db greška — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
