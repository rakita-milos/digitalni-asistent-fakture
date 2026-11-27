#!/usr/bin/env node
/**
 * Provjera staging/produkcijskih env varijabli **prije deploya** — bez ispisivanja tajni.
 *
 *   pnpm staging:check                      # proces env (npr. export iz platforme)
 *   pnpm staging:check --file .env.staging  # iz fajla
 *   pnpm staging:check --strict             # i upozorenja obaraju provjeru
 *   pnpm staging:check --json
 *   pnpm staging:check --selftest           # provjera same skripte (CI)
 *
 * Cilj: uhvatiti tipične greške prije nego API/web odu na staging — localhost URL, kratke JWT
 * tajne, CORS "*", nedostajući R2/SMS/Sentry, pogrešan NODE_ENV.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const result = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function value(env, key) {
  return (env[key] ?? '').trim();
}

function isHttps(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalhost(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return true;
  }
}

function add(checks, key, label, level, hint) {
  checks.push({ key, label, level, hint });
}

/** Vraća listu provjera; nivoe: ok | warn | error. */
export function validateStagingEnv(env) {
  const checks = [];

  add(
    checks,
    'NODE_ENV',
    'NODE_ENV=production',
    value(env, 'NODE_ENV') === 'production' ? 'ok' : 'error',
    'Staging mora da radi kao production (env.ts, cookie secure, rate limit).',
  );

  const db = value(env, 'DATABASE_URL');
  add(
    checks,
    'DATABASE_URL',
    'Postgres URL',
    /^postgres(ql)?:\/\//.test(db) ? 'ok' : 'error',
    'Neon pooled connection string (postgresql://...).',
  );
  if (db && !db.includes('sslmode=require')) {
    add(
      checks,
      'DATABASE_URL_SSL',
      'sslmode=require',
      'warn',
      'Neon zahtijeva TLS; dodaj ?sslmode=require.',
    );
  }

  const redis = value(env, 'REDIS_URL');
  add(
    checks,
    'REDIS_URL',
    'Redis URL',
    /^rediss?:\/\//.test(redis) ? 'ok' : 'error',
    'Upstash daje rediss:// URL.',
  );
  if (redis.startsWith('redis://')) {
    add(checks, 'REDIS_TLS', 'Redis preko TLS-a', 'warn', 'Upstash koristi rediss:// (TLS).');
  }

  const access = value(env, 'JWT_ACCESS_SECRET');
  const refresh = value(env, 'JWT_REFRESH_SECRET');
  add(
    checks,
    'JWT_ACCESS_SECRET',
    'JWT access tajna ≥ 32',
    access.length >= 32 ? 'ok' : 'error',
    'Najmanje 32 nasumična bajta.',
  );
  add(
    checks,
    'JWT_REFRESH_SECRET',
    'JWT refresh tajna ≥ 32',
    refresh.length >= 32 ? 'ok' : 'error',
    'Najmanje 32 nasumična bajta.',
  );
  if (access && refresh && access === refresh) {
    add(
      checks,
      'JWT_DISTINCT',
      'Access i refresh tajne su različite',
      'error',
      'Ne koristi istu tajnu za oba tokena.',
    );
  }

  const cors = value(env, 'CORS_ORIGIN');
  let corsOk = cors.length > 0 && cors !== '*';
  if (corsOk) {
    for (const origin of cors
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      if (!origin.startsWith('https://')) corsOk = false;
    }
  }
  add(
    checks,
    'CORS_ORIGIN',
    'CORS: https origin, ne *',
    corsOk ? 'ok' : 'error',
    'Tačan web domen, nikad *.',
  );

  for (const key of ['WEB_APP_URL', 'PUBLIC_API_URL']) {
    const url = value(env, key);
    add(
      checks,
      key,
      key + ' je https i nije localhost',
      isHttps(url) && !isLocalhost(url) ? 'ok' : 'error',
      'Linkovi u e-mail/SMS porukama moraju da vode na javni domen.',
    );
  }

  const sentry = value(env, 'SENTRY_DSN');
  add(
    checks,
    'SENTRY_DSN',
    'Sentry DSN',
    sentry ? (isHttps(sentry) ? 'ok' : 'error') : 'warn',
    'G12 traži DSN; bez njega nema monitoringa.',
  );

  const r2Keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const r2Set = r2Keys.filter((key) => value(env, key));
  add(
    checks,
    'R2',
    'R2 ključevi (svi ili nijedan)',
    r2Set.length === 0 ? 'warn' : r2Set.length === r2Keys.length ? 'ok' : 'error',
    'Bez R2 PDF se streamuje; djelimični ključevi su greška.',
  );

  const sms = value(env, 'SMS_PROVIDER');
  if (sms === 'http') {
    const smsOk =
      value(env, 'SMS_HTTP_URL') &&
      (value(env, 'SMS_HTTP_TOKEN') || value(env, 'SMS_API_KEY')) &&
      value(env, 'SMS_SENDER_ID');
    add(
      checks,
      'SMS',
      'SMS http provajder kompletan',
      smsOk ? 'ok' : 'error',
      'URL + token/API key + sender ID.',
    );
  } else {
    add(
      checks,
      'SMS',
      'SMS provajder (ne log)',
      'warn',
      'SMS_PROVIDER=log ne šalje poruke; G12 traži pravog provajdera.',
    );
  }

  // ESIR_MODE ima default "mock" u env.ts: izostavljeno znači mock (upozorenje, ne greška).
  const esir = value(env, 'ESIR_MODE');
  add(
    checks,
    'ESIR_MODE',
    'ESIR_MODE je mock (G0)',
    esir === '' || esir === 'mock' ? 'warn' : esir === 'esir' ? 'ok' : 'error',
    'Do G0 samo mock; esir još nije implementiran.',
  );

  // RATE_LIMIT_ENABLED ima default "true": izostavljeno je ispravno, samo "false" je rizik.
  const rateLimit = value(env, 'RATE_LIMIT_ENABLED');
  add(
    checks,
    'RATE_LIMIT_ENABLED',
    'Rate limit uključen',
    rateLimit === '' || rateLimit === 'true' ? 'ok' : rateLimit === 'false' ? 'warn' : 'error',
    'Produkcija ne smije bez rate limita.',
  );

  // Bez trust proxy-ja Express vidi IP proxy-ja, pa je rate limit globalan.
  const trustProxy = value(env, 'TRUST_PROXY');
  const trustProxyValid =
    trustProxy === '' ||
    trustProxy === 'true' ||
    trustProxy === 'false' ||
    /^(?:[1-9]|10)$/.test(trustProxy);
  add(
    checks,
    'TRUST_PROXY',
    'Proxy hopovi za realan IP',
    !trustProxyValid ? 'error' : trustProxy === 'false' ? 'warn' : 'ok',
    'Iza Railway/Fly proxy-ja postavi TRUST_PROXY=1; bez toga rate limit je globalan.',
  );

  const release = value(env, 'APP_RELEASE');
  add(
    checks,
    'APP_RELEASE',
    'APP_RELEASE = commit SHA',
    /^[0-9a-f]{7,40}$/i.test(release) ? 'ok' : 'warn',
    'git rev-parse --short HEAD.',
  );

  const pdfSecret = value(env, 'PDF_LINK_SECRET');
  if (pdfSecret) {
    add(
      checks,
      'PDF_LINK_SECRET',
      'PDF link tajna ≥ 16',
      pdfSecret.length >= 16 ? 'ok' : 'error',
      'Ili je izostavi (fallback na access tajnu).',
    );
  }

  for (const key of ['FEATURE_FISCAL_ENABLED', 'FEATURE_SMS_ENABLED', 'FEATURE_ACCOUNT_DELETION']) {
    // Sva tri imaju default "true" u env.ts; izostavljeno je ispravno.
    const current = value(env, key);
    add(
      checks,
      key,
      key + ' je true/false (default true)',
      current === '' || current === 'true' || current === 'false' ? 'ok' : 'error',
      'env.ts prihvata samo true/false.',
    );
  }

  return checks;
}

function summarize(checks) {
  return {
    errors: checks.filter((check) => check.level === 'error').length,
    warnings: checks.filter((check) => check.level === 'warn').length,
  };
}

function print(checks, json) {
  if (json) {
    process.stdout.write(JSON.stringify({ ...summarize(checks), checks }, null, 2) + '\n');
    return;
  }

  for (const check of checks) {
    const mark = check.level === 'ok' ? '✅' : check.level === 'warn' ? '⚠️' : '❌';
    process.stdout.write(mark + ' ' + check.label + '\n');
    if (check.level !== 'ok') process.stdout.write('     → ' + check.hint + '\n');
  }

  const { errors, warnings } = summarize(checks);
  process.stdout.write('\nRezultat: ' + errors + ' grešaka, ' + warnings + ' upozorenja\n');
}

function selftest() {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@neon.tech/db?sslmode=require',
    REDIS_URL: 'rediss://default:pass@upstash.io:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    CORS_ORIGIN: 'https://staging.digitalni-asistent.ba',
    WEB_APP_URL: 'https://staging.digitalni-asistent.ba',
    PUBLIC_API_URL: 'https://api-staging.digitalni-asistent.ba',
    SENTRY_DSN: 'https://key@sentry.io/1',
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    SMS_PROVIDER: 'http',
    SMS_HTTP_URL: 'https://sms.example.ba/send',
    SMS_HTTP_TOKEN: 'token',
    SMS_SENDER_ID: 'DA',
    ESIR_MODE: 'mock',
    RATE_LIMIT_ENABLED: 'true',
    APP_RELEASE: '85db4a9',
    FEATURE_FISCAL_ENABLED: 'true',
    FEATURE_SMS_ENABLED: 'true',
    FEATURE_ACCOUNT_DELETION: 'true',
  };

  const validChecks = validateStagingEnv(valid);
  assert.equal(summarize(validChecks).errors, 0, 'validan staging ne smije imati greške');
  assert.equal(summarize(validChecks).warnings, 1, 'samo ESIR mock upozorenje');

  const broken = {
    ...valid,
    NODE_ENV: 'development',
    DATABASE_URL: '',
    JWT_ACCESS_SECRET: 'short',
    JWT_REFRESH_SECRET: 'short',
    CORS_ORIGIN: '*',
    WEB_APP_URL: 'http://localhost:3000',
    PUBLIC_API_URL: 'http://127.0.0.1:3001',
    R2_ACCOUNT_ID: 'only-one',
  };
  assert.ok(summarize(validateStagingEnv(broken)).errors >= 7, 'pokvaren env mora imati greške');

  const minimal = {
    ...valid,
    SENTRY_DSN: '',
    R2_ACCOUNT_ID: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
    SMS_PROVIDER: '',
    ESIR_MODE: '',
    RATE_LIMIT_ENABLED: '',
    APP_RELEASE: '',
    FEATURE_FISCAL_ENABLED: '',
    FEATURE_SMS_ENABLED: '',
    FEATURE_ACCOUNT_DELETION: '',
  };
  const minimalSummary = summarize(validateStagingEnv(minimal));
  assert.equal(minimalSummary.errors, 0, 'defaulti ne smiju biti greške');
  assert.equal(minimalSummary.warnings, 5, 'Sentry, R2, SMS, ESIR i APP_RELEASE su upozorenja');

  process.stdout.write('staging:check selftest 3/3\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(
      'staging:check — provjera staging env varijabli\n\n  --file <putanja>  --json  --strict  --selftest\n',
    );
    return;
  }
  if (args.has('--selftest')) {
    selftest();
    return;
  }

  const argv = process.argv.slice(2);
  let fileArg;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--file=')) fileArg = arg.split('=')[1];
    else if (arg === '--file') fileArg = argv[index + 1];
  }
  const file = fileArg ? path.resolve(fileArg) : path.join(root, '.env.staging');
  const fromFile = existsSync(file) ? parseEnvFile(file) : {};
  const env = { ...process.env, ...fromFile };
  const checks = validateStagingEnv(env);
  print(checks, args.has('--json'));

  const { errors, warnings } = summarize(checks);
  if (errors > 0 || (args.has('--strict') && warnings > 0)) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
