import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env';

/**
 * Kratkotrajni HMAC token za javni PDF link iz e-mail/SMS poruke.
 * Token je vezan za ID fakture i vrijeme isteka (TTL ≤ 15 min, Pre-Deployment Checklist).
 * Ne zamjenjuje R2 signed URL (Sprint 10) — isti ugovor rute ostaje.
 */
function secret(): string {
  return env.PDF_LINK_SECRET ?? env.JWT_ACCESS_SECRET;
}

function sign(invoiceId: string, expiresAt: number): string {
  return createHmac('sha256', secret()).update(`${invoiceId}.${expiresAt}`).digest('base64url');
}

export function createPdfLinkToken(
  invoiceId: string,
  ttlSeconds: number = env.PDF_LINK_TTL_SECONDS,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expiresAt}.${sign(invoiceId, expiresAt)}`;
}

export function verifyPdfLinkToken(invoiceId: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [expiresRaw, signature] = parts;
  if (!expiresRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresRaw);

  if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
    return false;
  }
  if (expiresAt * 1000 <= Date.now()) {
    return false;
  }

  const expected = sign(invoiceId, expiresAt);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
