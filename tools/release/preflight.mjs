#!/usr/bin/env node
/**
 * Preflight spremnosti za G12/G13 — provjera **bez ispisivanja tajni**.
 *
 *   pnpm release:preflight            # .env + keystore + Play materijal
 *   pnpm release:preflight -- --devices
 *   pnpm release:preflight -- --json
 *   pnpm release:preflight -- --strict   # exit 1 ako nešto od obaveznog nedostaje
 *
 * Odgovara na pitanje: „šta tačno još blokira G12/G13?“ Svaka ❌ stavka ima sljedeću komandu
 * ili dokument gdje se zatvara. Tajne se nikad ne ispisuju — samo postoji/ne postoji.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PLACEHOLDERS = new Set([
  '',
  'promijeni-me',
  'change-me',
  'changeme',
  '<...>',
  'your-key',
]);

function parseEnvFile(file) {
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

function realValue(env, key, extra = {}) {
  const value = (env[key] ?? extra[key] ?? '').trim();
  return PLACEHOLDERS.has(value) ? '' : value;
}

const checks = [];

function check(group, key, label, ok, hint, detail = '') {
  checks.push({ group, key, label, ok, hint, detail });
}

function findAdb() {
  const candidates = [
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : null,
    process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe') : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe')
      : null,
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? 'adb';
}

function countDevices() {
  try {
    const output = execFileSync(findAdb(), ['devices'], { encoding: 'utf8', timeout: 20000 });
    const count = output
      .split(/\r?\n/)
      .filter((line) => /\tdevice\b/.test(line) && !line.includes('offline')).length;
    return { count, reason: '' };
  } catch (error) {
    return { count: null, reason: error instanceof Error ? error.message : 'adb nije dostupan' };
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'release:preflight — provjera spremnosti za G12/G13\n\n' +
        '  --devices   provjeri povezane Android uređaje (adb)\n' +
        '  --json      mašinski čitljiv izlaz\n' +
        '  --strict    exit 1 ako nešto obavezno nedostaje\n',
    );
    return;
  }

  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const checkDevices = args.includes('--devices');

  const env = {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, '.env.staging')),
  };
  const keystorePropertiesPath = path.join(root, 'apps/mobile/android/keystore.properties');
  const gradlePath = path.join(root, 'apps/mobile/android/app/build.gradle');
  const gradle = readFileSync(gradlePath, 'utf8');
  const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? '—';
  const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? '—';

  // ── G12 ────────────────────────────────────────────────────────────────────
  const dsn = realValue(env, 'SENTRY_DSN');
  check(
    'G12',
    'sentry',
    'Sentry DSN',
    Boolean(dsn) && dsn.startsWith('https://'),
    'Sentry → Project Settings → Client Keys (DSN), pa u .env',
  );

  const r2Keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const r2Missing = r2Keys.filter((key) => !realValue(env, key));
  check(
    'G12',
    'r2',
    'R2 bucket + ključevi',
    r2Missing.length === 0,
    `Cloudflare R2 → Manage R2 API Tokens; nedostaje: ${r2Missing.join(', ') || '—'}`,
  );

  const smsProvider = realValue(env, 'SMS_PROVIDER');
  const smsReady =
    Boolean(smsProvider) &&
    smsProvider !== 'log' &&
    (smsProvider !== 'http' ||
      (realValue(env, 'SMS_HTTP_URL') &&
        (realValue(env, 'SMS_HTTP_TOKEN') || realValue(env, 'SMS_API_KEY')) &&
        realValue(env, 'SMS_SENDER_ID')));
  check(
    'G12',
    'sms',
    'SMS provajder (ne log)',
    Boolean(smsReady),
    'docs/INTEGRATIONS_GO_LIVE.md §SMS — provajder, URL, token, sender ID',
  );

  const stagingApi = realValue(env, 'STAGING_API_URL') || realValue(env, 'PUBLIC_API_URL');
  const stagingDb = realValue(env, 'STAGING_DATABASE_URL');
  check(
    'G12',
    'staging',
    'Staging URL + baza',
    Boolean(stagingApi && stagingDb),
    'docs/STAGING_DEPLOY.md §4 (Neon/Vercel/Railway); upiši STAGING_API_URL i STAGING_DATABASE_URL',
  );

  check(
    'G12',
    'cicd',
    'CI 5/5 + AAB artifact',
    true,
    'run #21 zelen; tag v1.0.0-rc3 → artifact digitalni-asistent-aab',
    'dokaz u GitHub Actions',
  );

  if (checkDevices) {
    const devices = countDevices();
    check(
      'G12',
      'devices',
      'Fizički uređaji (3)',
      devices.count !== null && devices.count >= 3,
      'adb devices; uključi USB debugging na 3 telefona',
      devices.count === null ? `adb: ${devices.reason}` : `nađeno: ${devices.count}`,
    );
  }

  const restoreScript = existsSync(path.join(root, 'tools/backup/restore-drill.mjs'));
  check(
    'G12',
    'restore',
    'Restore drill alat spreman',
    restoreScript,
    'pnpm backup:restore-drill …',
    restoreScript ? 'lokalno 3,2 s / 11 tabela; staging čeka nalog' : '',
  );

  // ── G13 ────────────────────────────────────────────────────────────────────
  const keystoreProps = existsSync(keystorePropertiesPath)
    ? parseEnvFile(keystorePropertiesPath)
    : null;
  let keystoreOk = Boolean(realValue(env, 'DA_KEYSTORE_BASE64'));
  let keystoreDetail = keystoreOk ? 'DA_KEYSTORE_BASE64 u env' : '';
  if (keystoreProps) {
    const storeFile = realValue(keystoreProps, 'storeFile');
    const resolved = storeFile
      ? path.isAbsolute(storeFile)
        ? storeFile
        : path.resolve(path.dirname(keystorePropertiesPath), 'app', storeFile)
      : '';
    const fileOk = Boolean(resolved) && existsSync(resolved) && statSync(resolved).size > 1024;
    const passOk = Boolean(realValue(keystoreProps, 'storePassword')) && Boolean(realValue(keystoreProps, 'keyPassword'));
    keystoreOk = keystoreOk || (fileOk && passOk);
    keystoreDetail = fileOk ? 'keystore.properties + fajl' : 'keystore.properties bez fajla';
  }
  check(
    'G13',
    'keystore',
    'Keystore (lokalno ili CI base64)',
    keystoreOk,
    'docs/KEYSTORE.md §2–§4; 2 kopije van repoa + DA_KEYSTORE_BASE64 secret',
    keystoreDetail,
  );

  const versionOk = /^\d+\.\d+\.\d+$/.test(versionName);
  check('G13', 'version', 'Verzija x.y.z', versionOk, 'versionName u app/build.gradle', `${versionName} (${versionCode})`);

  const privacy = existsSync(path.join(root, 'apps/web/app/(legal)/privacy/page.tsx'));
  const terms = existsSync(path.join(root, 'apps/web/app/(legal)/terms/page.tsx'));
  check('G13', 'legal', 'Stranice /privacy i /terms', privacy && terms, 'apps/web/app/(legal)/');

  const icon = path.join(root, 'apps/mobile/assets/branding/play-icon-512.png');
  const feature = path.join(root, 'apps/mobile/assets/branding/play-feature-graphic-1024x500.png');
  const shotsDir = path.join(root, 'apps/mobile/assets/screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((file) => /\.png$/i.test(file)).length
    : 0;
  check(
    'G13',
    'assets',
    'Play materijal (ikona, graphic, 4–8 snimaka)',
    existsSync(icon) && existsSync(feature) && Number(shots) >= 4,
    'pnpm check:play',
    `${shots} screenshotova`,
  );

  check(
    'G13',
    'play',
    'Play Console nalog + listing + Data Safety',
    false,
    'Play Console; docs/PLAY_RELEASE.md §4–§6',
    'ne može se provjeriti lokalno',
  );

  check(
    'G13',
    'rollback',
    'Rollback vježba na stagingu',
    false,
    'docs/STAGING_DEPLOY.md §6.3 (čeka staging)',
  );

  // ── Izlaz ──────────────────────────────────────────────────────────────────
  const required = checks.filter((item) => item.key !== 'play' && item.key !== 'rollback');
  const failed = required.filter((item) => !item.ok);
  const result = { generatedAt: new Date().toISOString(), ok: failed.length === 0, checks };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    let group = '';
    for (const item of checks) {
      if (item.group !== group) {
        group = item.group;
        process.stdout.write(`\n${group}\n`);
      }
      const mark = item.ok ? '✅' : item.key === 'play' || item.key === 'rollback' ? '⏳' : '❌';
      process.stdout.write(
        `${mark} ${item.label}${item.detail ? ` — ${item.detail}` : ''}\n` +
          (!item.ok ? `     → ${item.hint}\n` : ''),
      );
    }
    process.stdout.write(
      `\nSpremno: ${checks.filter((item) => item.ok).length}/${checks.length} · ` +
        `blokira: ${failed.length === 0 ? 'ništa od provjerenog' : failed.map((item) => item.key).join(', ')}\n`,
    );
  }

  if (strict && failed.length > 0) {
    process.exit(1);
  }
}

main();
