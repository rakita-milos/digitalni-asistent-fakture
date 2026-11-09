/**
 * Backoff za ponovnu fiskalizaciju — §7.5: 1 min, 5 min, 15 min, 1 h, 6 h.
 * Nakon 5 neuspješnih pokušaja prestaje automatski retry (alarm > 3 dana je u workeru).
 */
export const FISCAL_RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 360] as const;

export function fiscalRetryDelayMinutes(failedAttempts: number): number | null {
  if (!Number.isInteger(failedAttempts) || failedAttempts < 0) {
    throw new Error(`Neispravan broj pokušaja: ${failedAttempts}`);
  }
  if (failedAttempts >= FISCAL_RETRY_DELAYS_MINUTES.length) {
    return null;
  }
  return FISCAL_RETRY_DELAYS_MINUTES[failedAttempts] ?? null;
}
