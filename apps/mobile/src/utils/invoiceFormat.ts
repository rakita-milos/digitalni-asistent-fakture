/** Zajednički prikaz faktura na mobilnom (statusi, načini plaćanja, formatiranje). */

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_FISCAL: 'Čeka fiskalizaciju',
  ISSUED: 'Izdato',
  SENT: 'Poslato',
  PARTIALLY_PAID: 'Djelimično plaćeno',
  PAID: 'Plaćeno',
  OVERDUE: 'Dospjelo',
  CANCELLED: 'Poništeno',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280',
  PENDING_FISCAL: '#B45309',
  ISSUED: '#1D4ED8',
  SENT: '#1D4ED8',
  PARTIALLY_PAID: '#B45309',
  PAID: '#16A34A',
  OVERDUE: '#B91C1C',
  CANCELLED: '#6B7280',
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  SALE: 'Račun',
  ADVANCE: 'PRAČUN',
};

export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'VOUCHER', 'OTHER'] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Gotovina',
  CARD: 'Kartica',
  TRANSFER: 'Transfer',
  VOUCHER: 'Voucher',
  OTHER: 'Ostalo',
};

/** Statusi u kojima je faktura otvorena za naplatu (§7.8). */
export const PAYABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

/** Statusi u kojima faktura može da se pošalje kupcu (API: `POST /invoices/:id/send`). */
export const SENDABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const;

export function formatFening(value: number): string {
  return `${(value / 100).toFixed(2)} KM`;
}

/** ISO datum → `dd.mm.yyyy` (bez Intl zavisnosti — Hermes na Androidu). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

export function formatQty(qtyMilli: number): string {
  return (qtyMilli / 1000).toString();
}

export function formatPercent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

export function isPayable(status: string): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status);
}

/** Slanje e-mailom/SMS-om je dozvoljeno samo za izdate (i kasnije) dokumente. */
export function canSendInvoice(status: string): boolean {
  return (SENDABLE_STATUSES as readonly string[]).includes(status);
}
