/**
 * W-03 masovne akcije (§8): pravila šta se smije izdati/podsjetiti u jednom potezu.
 * Web šalje zahtjeve po fakturi kroz postojeće API rute — nema bulk endpointa van §6.
 */
export const BULK_LIMIT = 50;

export interface BulkCandidate {
  status: string;
  type: string;
}

/** „Izdaj izabrane“ važi samo za DRAFT račun (PRAČUN se ne fiskalizuje). */
export function canBulkIssue(invoice: BulkCandidate): boolean {
  return invoice.status === 'DRAFT' && invoice.type === 'SALE';
}

/** „Pošalji podsjetnik“ za izdate i neplaćene/djelimično plaćene fakture. */
export function canBulkRemind(invoice: BulkCandidate): boolean {
  return ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status);
}
