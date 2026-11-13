#!/usr/bin/env node
/**
 * Generator placeholder brend materijala (S11-4): Play ikona 512×512,
 * feature graphic 1024×500 i Android launcher ikone (mipmap-*).
 *
 * Namjerno bez tekstа — wordmark i finalni brend dolaze od dizajnera.
 * Skripta koristi samo Node (zlib) — nema native zavisnosti, pa radi i u CI-ju.
 *
 *   node apps/mobile/scripts/generate-play-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..');
const repoAssets = join(mobileRoot, 'assets', 'branding');
const androidRes = join(mobileRoot, 'android', 'app', 'src', 'main', 'res');

const COLORS = {
  navy: [31, 59, 115],
  blue: [46, 95, 163],
  white: [255, 255, 255],
  paperLine: [203, 213, 225],
  green: [22, 163, 74],
  greenDark: [21, 128, 61],
};

// ---------- PNG encoder ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- raster canvas (supersampled) ----------
class Canvas {
  constructor(width, height, scale = 4) {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.w = width * scale;
    this.h = height * scale;
    this.data = new Float32Array(this.w * this.h * 4); // 0..1, nepremnoženo
  }

  blend(index, [r, g, b, a = 1]) {
    const src = [r / 255, g / 255, b / 255, a];
    const da = this.data[index + 3];
    const outA = src[3] + da * (1 - src[3]);
    if (outA === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      const srcC = src[channel] * src[3];
      const dstC = this.data[index + channel] * da;
      this.data[index + channel] = (srcC + dstC * (1 - src[3])) / outA;
    }
    this.data[index + 3] = outA;
  }

  /** Ispuna po pikselu uz uslov (finalne koordinate). */
  fillShape(minX, minY, maxX, maxY, inside, color) {
    const s = this.scale;
    const x0 = Math.max(0, Math.floor(minX * s));
    const y0 = Math.max(0, Math.floor(minY * s));
    const x1 = Math.min(this.w - 1, Math.ceil(maxX * s));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY * s));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (inside((x + 0.5) / s, (y + 0.5) / s)) {
          this.blend((y * this.w + x) * 4, color);
        }
      }
    }
  }

  fillRect(x, y, w, h, color) {
    this.fillShape(
      x,
      y,
      x + w,
      y + h,
      (px, py) => px >= x && px <= x + w && py >= y && py <= y + h,
      color,
    );
  }

  fillRoundRect(x, y, w, h, radius, color) {
    const r = Math.min(radius, w / 2, h / 2);
    this.fillShape(
      x,
      y,
      x + w,
      y + h,
      (px, py) => {
        if (px < x || px > x + w || py < y || py > y + h) return false;
        const cx = Math.min(Math.max(px, x + r), x + w - r);
        const cy = Math.min(Math.max(py, y + r), y + h - r);
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      },
      color,
    );
  }

  fillCircle(cx, cy, radius, color) {
    this.fillShape(
      cx - radius,
      cy - radius,
      cx + radius,
      cy + radius,
      (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius,
      color,
    );
  }

  verticalGradient(x, y, w, h, from, to) {
    const steps = Math.ceil(h);
    for (let i = 0; i < steps; i += 1) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const color = from.map((value, index) => value + (to[index] - value) * t);
      this.fillRect(x, y + i, w, 1, color);
    }
  }

  /** Downsample (box filter) u finalni RGBA Buffer. */
  toPng() {
    const s = this.scale;
    const out = Buffer.alloc(this.width * this.height * 4);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        for (let sy = 0; sy < s; sy += 1) {
          for (let sx = 0; sx < s; sx += 1) {
            const index = ((y * s + sy) * this.w + (x * s + sx)) * 4;
            r += this.data[index] * this.data[index + 3];
            g += this.data[index + 1] * this.data[index + 3];
            b += this.data[index + 2] * this.data[index + 3];
            a += this.data[index + 3];
          }
        }
        const pixels = s * s;
        const alpha = a / pixels;
        const offset = (y * this.width + x) * 4;
        out[offset + 3] = Math.round(alpha * 255);
        if (a > 0) {
          out[offset] = Math.round((r / a) * 255);
          out[offset + 1] = Math.round((g / a) * 255);
          out[offset + 2] = Math.round((b / a) * 255);
        }
      }
    }
    return encodePng(this.width, this.height, out);
  }
}

// ---------- motiv ----------
function drawSheet(canvas, x, y, w, h, scale = 1) {
  canvas.fillRoundRect(x, y, w, h, w * 0.06, COLORS.white);
  const lineX = x + w * 0.18;
  const lineH = h * 0.045 * scale;
  const rows = [
    { dy: 0.24, width: 0.52 },
    { dy: 0.38, width: 0.4 },
    { dy: 0.52, width: 0.46 },
  ];
  for (const row of rows) {
    canvas.fillRoundRect(lineX, y + h * row.dy, w * row.width, lineH, lineH / 2, COLORS.paperLine);
  }
  canvas.fillRoundRect(lineX, y + h * 0.74, w * 0.34, h * 0.075, h * 0.035, COLORS.green);
}

function drawAppIcon(size, { round = false, square = false } = {}) {
  const canvas = new Canvas(size, size, 4);
  const radius = round ? size / 2 : size * 0.2;
  const inside = round
    ? (px, py) => (px - size / 2) ** 2 + (py - size / 2) ** 2 <= (size / 2) ** 2
    : (px, py) => {
        if (px < 0 || py < 0 || px > size || py > size) return false;
        const cx = Math.min(Math.max(px, radius), size - radius);
        const cy = Math.min(Math.max(py, radius), size - radius);
        return (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius;
      };
  canvas.fillShape(0, 0, size, size, inside, COLORS.navy);
  // gradient preko rounded/circular maske
  const gradient = new Canvas(size, size, 4);
  gradient.verticalGradient(0, 0, size, size, COLORS.navy, COLORS.blue);
  for (let y = 0; y < canvas.h; y += 1) {
    for (let x = 0; x < canvas.w; x += 1) {
      const index = (y * canvas.w + x) * 4;
      if (canvas.data[index + 3] > 0 && inside((x + 0.5) / 4, (y + 0.5) / 4)) {
        canvas.data.set(gradient.data.subarray(index, index + 4), index);
        canvas.data[index + 3] = 1;
      }
    }
  }
  if (square) {
    // Play ikona: puna površina, bez providnosti i bez zaobljenja.
    const base = new Canvas(size, size, 4);
    base.verticalGradient(0, 0, size, size, COLORS.navy, COLORS.blue);
    for (let i = 0; i < base.data.length; i += 4) {
      base.data[i + 3] = 1;
    }
    drawSheet(base, size * 0.24, size * 0.16, size * 0.52, size * 0.68);
    return base.toPng();
  }
  drawSheet(canvas, size * 0.24, size * 0.16, size * 0.52, size * 0.68);
  return canvas.toPng();
}

function drawFeatureGraphic() {
  const width = 1024;
  const height = 500;
  const canvas = new Canvas(width, height, 2);
  canvas.verticalGradient(0, 0, width, height, COLORS.navy, COLORS.blue);

  // blaži svjetlosni krugovi (dubina, bez teksta)
  canvas.fillCircle(880, 60, 260, [255, 255, 255, 0.05]);
  canvas.fillCircle(120, 470, 220, [255, 255, 255, 0.05]);

  // list papira / faktura lijevo
  drawSheet(canvas, 128, 96, 280, 308);

  // redovi faktura desno (apstraktne stavke liste)
  const rows = [
    { y: 128, w: 470, alpha: 0.9 },
    { y: 196, w: 420, alpha: 0.65 },
    { y: 264, w: 450, alpha: 0.5 },
  ];
  for (const row of rows) {
    canvas.fillRoundRect(500, row.y, row.w, 40, 20, [255, 255, 255, row.alpha]);
  }
  canvas.fillRoundRect(500, 344, 190, 24, 12, [22, 163, 74, 0.95]);

  return canvas.toPng();
}

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`  ✓ ${path.replace(mobileRoot, 'apps/mobile')} (${buffer.length} B)`);
}

const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

console.log('Brend materijal (placeholder — finalni brend od dizajnera):');
write(join(repoAssets, 'play-icon-512.png'), drawAppIcon(512, { square: true }));
write(join(repoAssets, 'play-feature-graphic-1024x500.png'), drawFeatureGraphic());
for (const { dir, size } of DENSITIES) {
  write(join(androidRes, dir, 'ic_launcher.png'), drawAppIcon(size));
  write(join(androidRes, dir, 'ic_launcher_round.png'), drawAppIcon(size, { round: true }));
}
console.log('Gotovo.');
