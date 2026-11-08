import { z } from 'zod';

/** Poslovna pravila iz MASTER PROMPT §7.11 (validacije). */

/** JIB — 13 cifara. ⚠ checksum još nije potvrđen, zato se za sada provjerava samo dužina. */
export const JIB_LENGTH = 13;
export const jibSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${JIB_LENGTH}}$`), `JIB mora imati tačno ${JIB_LENGTH} cifara`);

/** Telefon u formatu +387 (BiH), npr. +38766123456. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+387\d{8}$/, 'Telefon mora biti u formatu +387XXXXXXXX');

/** E-mail (RFC 5322, najviše 254 znaka). */
export const emailSchema = z.string().trim().email('Neispravan e-mail').max(254);

/**
 * ID je UUID v7 (string) — MASTER PROMPT §5.
 * Zod-ov ugrađeni `uuid()` odbija v7, zato vlastiti regex.
 */
export const uuidV7Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Očekivan UUID v7',
  );
