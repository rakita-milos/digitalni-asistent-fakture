/**
 * Alarm za PENDING_FISCAL (§7.5): zakon dopušta 5 dana, alarm se diže poslije 3.
 * Dedupe je po fakturi i UTC danu — jedan log po danu, ne na svakih 5 minuta.
 */
export const FISCAL_ALARM_AFTER_DAYS = 3;
const DAY_MS = 86_400_000;

export function isFiscalAlarmDue(updatedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - updatedAt.getTime() > FISCAL_ALARM_AFTER_DAYS * DAY_MS;
}

/** Redis ključ za dnevni dedupe alarma. */
export function fiscalAlarmKey(invoiceId: string, now: Date = new Date()): string {
  return `alarm:fiscal:${invoiceId}:${now.toISOString().slice(0, 10)}`;
}
