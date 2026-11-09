import { z } from 'zod';

import { emailSchema, jibSchema, phoneSchema } from '../validation';

/**
 * Auth šeme (MASTER PROMPT §6, rute /auth/*, §10 sigurnost).
 * Iste šeme koriste API (validacija ulaza) i mobilni/web (forme).
 */

/** Lozinka: minimum 8 znakova (§10 ne propisuje politiku — dogovoreno na kickoff-u Sprinta 1). */
export const passwordSchema = z
  .string()
  .min(8, 'Lozinka mora imati najmanje 8 znakova')
  .max(128, 'Lozinka je predugačka');

/** Platforma uređaja — §5 navodi kolonu `platform` bez enuma; ovo su podržane vrijednosti. */
export const DEVICE_PLATFORMS = ['android', 'ios', 'web'] as const;
export const deviceSchema = z.object({
  platform: z.enum(DEVICE_PLATFORMS),
  appVersion: z.string().trim().max(50).optional(),
  pushToken: z.string().trim().max(4096).optional(),
});
export type DeviceInput = z.infer<typeof deviceSchema>;

/** POST /auth/register — firma + vlasnik. */
export const registerSchema = z.object({
  company: z.object({
    name: z.string().trim().min(1).max(200),
    jib: jibSchema,
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    phone: phoneSchema,
    email: emailSchema,
    numberingPrefix: z.string().trim().max(20).default(''),
    numberingYear: z.number().int().min(2020).max(2100).optional(),
    defaultDueDays: z.number().int().min(0).max(365).default(15),
  }),
  owner: z.object({
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
  }),
  device: deviceSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** POST /auth/login — email/telefon + lozinka (§6). */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
  device: deviceSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** POST /auth/refresh — rotacija tokena (§10). */
export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Neispravan refresh token').max(4096),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** POST /auth/otp/request — SMS kod (§6). */
export const otpRequestSchema = z.object({
  phone: phoneSchema,
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

/** POST /auth/otp/verify — provjera koda (§6). */
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Kod ima 6 cifara'),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

/** Sesija koju vraćaju register/login/refresh. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  company: AuthCompany;
}

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  phone: string;
  role: string;
}

export interface AuthCompany {
  id: string;
  name: string;
}
