import { z } from 'zod';

/**
 * Brisanje naloga (GDPR, §10 i §21.12) — traži eksplicitnu potvrdu.
 * API dodatno provjerava `FEATURE_ACCOUNT_DELETION` i da je korisnik vlasnik.
 */
export const deleteAccountSchema = z
  .object({
    confirmation: z.string().trim(),
  })
  .refine((value) => value.confirmation === 'OBRISI', {
    message: 'Upišite OBRISI za potvrdu brisanja',
    path: ['confirmation'],
  });
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
