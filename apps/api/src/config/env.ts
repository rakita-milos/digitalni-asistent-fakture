import { z } from 'zod';

/**
 * Validacija env varijabli pri startu API-ja (§2, §10).
 * `.env` se učitava iz apps/api/.env (dotenv, ne prepisuje postojeće env varijable).
 */
import 'dotenv/config';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const durationPattern = /^(\d+)([smhd])$/;

function parseDuration(secondsValue: string, fallbackSeconds: number): number {
  if (!secondsValue) return fallbackSeconds;
  const match = durationPattern.exec(secondsValue);
  if (!match) {
    throw new Error(`Neispravan format trajanja: "${secondsValue}" (očekivano npr. 15m, 30d)`);
  }
  const amount = Number(match[1] ?? '0');
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 1);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL je obavezan'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET mora imati najmanje 16 znakova'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET mora imati najmanje 16 znakova'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  SMS_PROVIDER: z.string().default('log'),
  /// E-mail: 'log' u razvoju (link se ispiše u log); pravi provajder u Sprintu 10.
  MAIL_PROVIDER: z.string().default('log'),
  MAIL_FROM: z.string().default('Digitalni Asistent <no-reply@digitalni-asistent.ba>'),
  /// Bazni URL web aplikacije — koristi se za linkove u e-mailovima.
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  /// Reset lozinke: token važi 30 min, jednokratan je (§21.2).
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(1800),
  /// Javni URL API-ja — koristi se za linkove u e-mail/SMS porukama (PDF fakture).
  PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  /// HMAC tajna za kratkotrajni PDF link iz poruke; fallback na access secret.
  PDF_LINK_SECRET: z.string().min(16).optional(),
  /// PDF link iz poruke važi najviše 15 min (Pre-Deployment Checklist).
  PDF_LINK_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  /// GDPR brisanje naloga — može se isključiti bez deploya dok pravnik ne potvrdi tok.
  FEATURE_ACCOUNT_DELETION: z.enum(['true', 'false']).default('true'),
  /// Fiskalizacija: 'mock' dok operater ne odgovori (G0); 'esir' nije implementiran.
  ESIR_MODE: z.enum(['mock', 'esir']).default('mock'),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  RATE_LIMIT_ENABLED: parsed.RATE_LIMIT_ENABLED === 'true',
  FEATURE_ACCOUNT_DELETION: parsed.FEATURE_ACCOUNT_DELETION === 'true',
} as const;

export const ACCESS_TOKEN_TTL_SECONDS = parseDuration(env.JWT_ACCESS_TTL, 900);
export const REFRESH_TOKEN_TTL_SECONDS = parseDuration(env.JWT_REFRESH_TTL, 2592000);
