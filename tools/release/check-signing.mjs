#!/usr/bin/env node
/**
 * Provjera release potpisivanja (G13/T13-2) — **bez ispisivanja tajni**.
 *
 *   pnpm release:check-signing
 *
 * Provjerava:
 *  - lokalni `apps/mobile/android/keystore.properties` (ako postoji): obavezna polja, placeholderi,
 *    postoji li keystore fajl na navedenoj putanji;
 *  - CI env (`DA_KEYSTORE_BASE64` ili `DA_KEYSTORE_PATH` + lozinke/alias): da li je kompletan;
 *  - `versionName`/`versionCode` u `app/build.gradle`.
 *
 * Exit 0 = konfiguracija je ispravna ili je svjesno „nema keystore-a → debug potpis“.
 * Exit 1 = konfiguracija postoji ali je neispravna (npr. placeholder lozinka).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const androidDir = path.join(root, 'apps/mobile/android');
const keystoreProperties = path.join(androidDir, 'keystore.properties');
const buildGradle = path.join(root, 'apps/mobile/android/app/build.gradle');

const PLACEHOLDERS = new Set(['promijeni-me', 'change-me', '', '/putanja/do/digitalni-asistent-release.keystore']);
const REQUIRED = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];

const problems = [];
const notes = [];

function parseProperties(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

function checkVersion() {
  const gradle = readFileSync(buildGradle, 'utf8');
  const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
  const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  if (!versionCode || !versionName) {
    problems.push('Ne mogu naći versionCode/versionName u app/build.gradle.');
    return;
  }
  notes.push(`Verzija: ${versionName} (${versionCode}).`);
  if (!/^\d+\.\d+\.\d+$/.test(versionName)) {
    problems.push(`versionName "${versionName}" nije u formatu x.y.z.`);
  }
}

function checkLocalProperties() {
  if (!existsSync(keystoreProperties)) {
    notes.push('Nema keystore.properties → lokalni release build koristi debug potpis.');
    return false;
  }

  const properties = parseProperties(readFileSync(keystoreProperties, 'utf8'));
  for (const key of REQUIRED) {
    if (!properties[key]) problems.push(`keystore.properties: nedostaje ${key}.`);
    else if (PLACEHOLDERS.has(properties[key])) problems.push(`keystore.properties: ${key} je placeholder.`);
  }

  if (properties.storeFile && !PLACEHOLDERS.has(properties.storeFile)) {
    const file = path.isAbsolute(properties.storeFile)
      ? properties.storeFile
      : path.resolve(androidDir, 'app', properties.storeFile);
    if (!existsSync(file)) problems.push(`Keystore fajl ne postoji: ${file}`);
    else notes.push(`Keystore postoji: ${path.relative(root, file)}`);
  }

  return true;
}

function checkCiEnv() {
  const base64 = process.env.DA_KEYSTORE_BASE64;
  const pathEnv = process.env.DA_KEYSTORE_PATH;

  if (!base64 && !pathEnv) {
    notes.push('CI: nema DA_KEYSTORE_BASE64/DA_KEYSTORE_PATH → AAB bi bio debug-potpisan.');
    return false;
  }

  if (base64) {
    if (base64.length < 100) problems.push('DA_KEYSTORE_BASE64 je prekratak za keystore.');
    else notes.push(`CI: DA_KEYSTORE_BASE64 postoji (${Math.round(base64.length / 1024)} KB base64).`);
  }
  if (pathEnv) {
    if (!existsSync(pathEnv)) problems.push(`CI: DA_KEYSTORE_PATH ne postoji na runneru: ${pathEnv}`);
    else notes.push('CI: DA_KEYSTORE_PATH postoji.');
  }
  for (const key of ['DA_KEYSTORE_PASSWORD', 'DA_KEY_ALIAS', 'DA_KEY_PASSWORD']) {
    if (!process.env[key]) problems.push(`CI: nedostaje ${key}.`);
  }

  return true;
}

checkVersion();
const local = checkLocalProperties();
const ci = checkCiEnv();

if (!local && !ci) {
  notes.push('Zaključak: potpisivanje nije konfigurisano (dozvoljeno za interne APK/AAB, ne za Play).');
} else if (problems.length === 0) {
  notes.push('Zaključak: potpisivanje je kompletno.');
}

process.stdout.write(`${notes.map((note) => `• ${note}`).join('\n')}\n`);
if (problems.length > 0) {
  process.stderr.write(`\nProblemi:\n${problems.map((problem) => `✗ ${problem}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('\nOK.\n');
