/**
 * Numeracija faktura — §7.1: `{year}-{seq:4}`, po firmi **i tipu**, monotono rastuće,
 * bez rupa, počinje od 1 svake godine.
 *
 * Broj se dodjeljuje pri izdavanju (Sprint 3); draft koristi privremeni `DRAFT-…` broj.
 * Sekvence se vode u `companies.numbering_next` (SALE) i `numbering_next_advance` (ADVANCE).
 */
export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Neispravna godina numeracije: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Neispravna sekvenca numeracije: ${sequence}`);
  }
  return `${year}-${String(sequence).padStart(4, '0')}`;
}

/** Privremeni broj drafta — nikad se ne izdaje kupcu i zamjenjuje se pravim pri izdavanju. */
export function formatDraftNumber(randomPart: string): string {
  return `DRAFT-${randomPart.toUpperCase()}`;
}
