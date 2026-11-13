/**
 * Minimalni događaji za pilot metrike (S11-7).
 *
 * Pravilo: bez ličnih podataka — samo ID-jevi (pseudonimni) i kanal.
 * Ne dodavati email, telefon, imena kupaca ni sadržaj poruka.
 */
export const ANALYTICS_EVENTS = [
  'registration',
  'setup_completed',
  'invoice_issued',
  'payment_recorded',
  'reminder_sent',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsProps {
  companyId?: string;
  invoiceId?: string;
  channel?: 'email' | 'sms';
}
