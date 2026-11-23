#!/usr/bin/env node
/**
 * Provjera Play grafičkog materijala (S12B-4).
 *
 * Play zahtjevi koje provjeravamo:
 *  - ikona: 512×512 PNG (32-bit, providnost je dozvoljena);
 *  - feature graphic: 1024×500, bez providnosti (JPEG ili 24-bit PNG);
 *  - screenshotovi: 4–8 PNG, 320–3840 px, odnos stranica ≤ 2:1, bez providnosti.
 *
 * Skripta ne treba zavisnosti (čita PNG IHDR). Pokretanje: `pnpm check:play`.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'apps/mobile/assets');

const ICON = path.join(assets, 'branding/play-icon-512.png');
const FEATURE = path.join(assets, 'branding/play-feature-graphic-1024x500.png');
const SHOTS_DIR = path.join(assets, 'screenshots');

const MIN_PX = 320;
const MAX_PX = 3840;

/** @returns {{width:number,height:number,colorType:number,bitDepth:number,hasAlphaChunk:boolean}} */
function pngInfo(file) {
  const buffer = readFileSync(file);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`${path.relative(root, file)} nije PNG`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  return { width, height, bitDepth, colorType, hasAlphaChunk: buffer.includes('tRNS') };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const problems = [];
const checked = [];

function check(
  name,
  file,
  { width, height, allowAlpha = false, enforceRatio = true } = {},
) {
  if (!existsSync(file)) {
    problems.push(`${name}: nedostaje ${path.relative(root, file)}`);
    return;
  }
  const info = pngInfo(file);
  const alpha = info.colorType === 4 || info.colorType === 6 || info.hasAlphaChunk;
  if (alpha && !allowAlpha) {
    problems.push(`${name}: ima providnost (colorType ${info.colorType})`);
  }
  if (width && info.width !== width) problems.push(`${name}: širina ${info.width} ≠ ${width}`);
  if (height && info.height !== height) problems.push(`${name}: visina ${info.height} ≠ ${height}`);
  if (enforceRatio) {
    const ratio = Math.max(info.width, info.height) / Math.min(info.width, info.height);
    if (ratio > 2) problems.push(`${name}: odnos ${ratio.toFixed(2)}:1 > 2:1`);
  }
  if (
    info.width < MIN_PX ||
    info.height < MIN_PX ||
    info.width > MAX_PX ||
    info.height > MAX_PX
  ) {
    problems.push(`${name}: dimenzije ${info.width}×${info.height} van 320–3840`);
  }
  checked.push(`${path.basename(file)} ${info.width}×${info.height}${alpha ? ' ALPHA' : ''}`);
}

check('ikona 512×512', ICON, { width: 512, height: 512, allowAlpha: true, enforceRatio: false });

// Feature graphic je u planu PNG; ako se zamijeni JPEG-om, provjera se preskače uz upozorenje.
if (existsSync(FEATURE)) {
  const buf = readFileSync(FEATURE);
  const isPng = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (isPng) {
    check('feature graphic 1024×500', FEATURE, {
      width: 1024,
      height: 500,
      enforceRatio: false,
    });
  } else {
    checked.push(`${path.basename(FEATURE)} (JPEG — dimenzije provjeriti ručno)`);
  }
} else {
  problems.push(`feature graphic: nedostaje ${path.relative(root, FEATURE)}`);
}

const shots = existsSync(SHOTS_DIR)
  ? readdirSync(SHOTS_DIR)
      .filter((file) => /\.png$/i.test(file))
      .sort()
  : [];

if (shots.length < 4 || shots.length > 8) {
  problems.push(`screenshotovi: ${shots.length} (Play traži 4–8)`);
}

for (const file of shots) {
  check(`screenshot ${file}`, path.join(SHOTS_DIR, file));
}

if (checked.length > 0) {
  process.stdout.write(`Provjereno:\n  ${checked.join('\n  ')}\n`);
}

if (problems.length > 0) {
  process.stderr.write(`\nProblemi (${problems.length}):\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}

process.stdout.write(`\nOK: ${shots.length} screenshotova + ikona/feature graphic.\n`);
