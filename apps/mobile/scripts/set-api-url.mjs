#!/usr/bin/env node
/**
 * Upisuje API/web URL u `src/app-config.json` prije builda.
 *
 *   DA_API_URL=https://api-staging.example.ba node apps/mobile/scripts/set-api-url.mjs
 *   DA_API_URL=https://api.digitalni-asistent.ba node apps/mobile/scripts/set-api-url.mjs --release
 *
 * Bez `DA_API_URL`/`DA_WEB_URL` skripta ne mijenja ništa (izlaz 0), pa je bezbjedna u CI-ju.
 * `--release` zahtijeva `DA_API_URL` i samo https — release build ima cleartext isključen.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../src/app-config.json');
const release = process.argv.includes('--release');
const apiUrl = process.env.DA_API_URL?.trim();
const webUrl = process.env.DA_WEB_URL?.trim();

function parseUrl(value, name, { httpsOnly }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} nije validan apsolutni URL.`);
  }
  if (url.protocol !== 'https:' && (httpsOnly || url.protocol !== 'http:')) {
    throw new Error(`${name} mora biti https${httpsOnly ? ' za release build' : ''}.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${name} ne smije imati query ni fragment.`);
  }
  return url.toString().replace(/\/+$/, '');
}

if (!apiUrl && release) {
  throw new Error('DA_API_URL nije postavljen, a traži se release build.');
}

if (!apiUrl && !webUrl) {
  console.log('app-config.json nije mijenjan (DA_API_URL/DA_WEB_URL nisu postavljeni).');
  process.exit(0);
}

const current = JSON.parse(readFileSync(configPath, 'utf8'));
if (apiUrl) current.apiUrl = parseUrl(apiUrl, 'DA_API_URL', { httpsOnly: release });
if (webUrl) current.webUrl = parseUrl(webUrl, 'DA_WEB_URL', { httpsOnly: true });

writeFileSync(configPath, JSON.stringify(current, null, 2) + '\n');
console.log(`app-config.json ažuriran: API host ${new URL(current.apiUrl).host}.`);
