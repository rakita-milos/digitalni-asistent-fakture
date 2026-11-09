export function formatFening(value: number): string {
  return `${(value / 100).toFixed(2)} KM`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('bs-BA', {
    timeZone: 'Europe/Sarajevo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

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

export const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_FISCAL: 'bg-amber-100 text-amber-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-blue-100 text-blue-800',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

export const BUCKET_LABELS: Record<string, string> = {
  current: 'Nije dospjelo',
  '1-30': '1–30 dana',
  '31-60': '31–60 dana',
  '61-90': '61–90 dana',
  '90+': '90+ dana',
};
