/** Zajednički render šablona podsjetnika (§7.9) — koristi ga ručni i worker tok. */

export function formatFening(value: bigint): string {
  return `${(Number(value) / 100).toFixed(2)} KM`;
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('bs-BA', {
    timeZone: 'Europe/Sarajevo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(broj|iznos|rok|firma)\}/g, (_match, key: string) => values[key] ?? '');
}
