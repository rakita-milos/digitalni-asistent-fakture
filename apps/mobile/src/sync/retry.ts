/**
 * Retry politika za offline queue (S11-1 audit E6).
 *
 * Kad push padne (mreža ili serverska greška), operacija ostaje u queue-u i ponavlja se
 * po backoff-u 1m/5m/15m/1h/6h — isti ritam kao fiskalni retry u workeru.
 * Poslije `SYNC_MAX_ATTEMPTS` pokušaja stavka prelazi u `FAILED` (korisnik je vidi i može
 * ručno ponoviti slanje). Queue stariji od 3 dana diže lokalni alarm (zakon dopušta 5).
 */
export const SYNC_MAX_ATTEMPTS = 5;

/** Backoff po pokušaju: poslije 1. pada 1 min, poslije 2. 5 min, itd. */
export const SYNC_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

/** Queue stariji od ovoga diže alarm u UI-ju (server alarm je 3 dana, zakon 5). */
export const SYNC_STALE_AFTER_DAYS = 3;

const DAY_MS = 86_400_000;

export type QueueStatus = 'PENDING' | 'FAILED';

export interface RetryState {
  attempts: number;
  status: QueueStatus;
  /** ISO vrijeme sljedećeg pokušaja; `null` kada se više ne pokušava. */
  nextAttemptAt: string | null;
}

/**
 * Sljedeće stanje poslije neuspjelog pokušaja.
 * `previousAttempts` je broj već propalih pokušaja (0 za prvi pad).
 */
export function planRetry(previousAttempts: number, now: Date = new Date()): RetryState {
  const attempts = Math.max(0, Math.trunc(previousAttempts)) + 1;

  if (attempts >= SYNC_MAX_ATTEMPTS) {
    return { attempts, status: 'FAILED', nextAttemptAt: null };
  }

  const index = Math.min(attempts - 1, SYNC_BACKOFF_MS.length - 1);
  const delay = SYNC_BACKOFF_MS[index] ?? SYNC_BACKOFF_MS[SYNC_BACKOFF_MS.length - 1] ?? 60_000;
  return {
    attempts,
    status: 'PENDING',
    nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
  };
}

/** Da li je red spreman za sljedeći pokušaj (nema `nextAttemptAt` ili je prošao). */
export function isRetryDue(nextAttemptAt: string | null, now: Date = new Date()): boolean {
  if (!nextAttemptAt) {
    return true;
  }
  const timestamp = Date.parse(nextAttemptAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return timestamp <= now.getTime();
}

/** Da li je operacija u queue-u starija od `maxAgeDays` (alarm). */
export function isStale(
  createdAt: string,
  now: Date = new Date(),
  maxAgeDays: number = SYNC_STALE_AFTER_DAYS,
): boolean {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return now.getTime() - timestamp > maxAgeDays * DAY_MS;
}

export interface QueueRowSummary {
  status: string;
  createdAt: string;
  nextAttemptAt?: string | null;
}

export interface QueueAlarm {
  pending: number;
  /** PENDING stavke koje su sada spremne za slanje. */
  due: number;
  failed: number;
  stale: number;
}

/** Zbirno stanje queue-a za prikaz u UI-ju (bez čitanja cijelog payload-a). */
export function summarizeQueue(rows: QueueRowSummary[], now: Date = new Date()): QueueAlarm {
  let pending = 0;
  let due = 0;
  let failed = 0;
  let stale = 0;

  for (const row of rows) {
    if (row.status === 'FAILED') {
      failed += 1;
      continue;
    }
    pending += 1;
    if (isRetryDue(row.nextAttemptAt ?? null, now)) {
      due += 1;
    }
    if (isStale(row.createdAt, now)) {
      stale += 1;
    }
  }

  return { pending, due, failed, stale };
}

/** Poruka za UI (jedna linija); `null` kad nema šta upozoriti. */
export function queueAlarmMessage(summary: QueueAlarm): string | null {
  if (summary.stale > 0) {
    return `Neke izmjene nisu poslane više od ${SYNC_STALE_AFTER_DAYS} dana (${summary.stale}). Provjerite mrežu.`;
  }
  if (summary.failed > 0) {
    return `Izmjene koje nisu poslane: ${summary.failed}. Pokušajte ponovo.`;
  }
  if (summary.pending > 0) {
    return `Lokalne izmjene čekaju slanje: ${summary.pending}.`;
  }
  return null;
}
