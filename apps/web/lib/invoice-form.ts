/**
 * Zajednički tipovi i helperi za web editor fakture (W-04).
 *
 * API prima iznose u feningu (integer) i količine u `qtyMilli` (×1000),
 * a datume kao ISO string sa offsetom. Forma radi sa decimalnim unosima
 * (KM, komada, procenata) — konverzija je ovdje, na jednom mjestu.
 */

export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'VOUCHER', 'OTHER'] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Gotovina',
  CARD: 'Kartica',
  TRANSFER: 'Transfer',
  VOUCHER: 'Voucher',
  OTHER: 'Ostalo',
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  SALE: 'Račun',
  ADVANCE: 'PRAČUN',
};

export interface CustomerOption {
  id: string;
  name: string;
}

export interface ItemOption {
  id: string;
  name: string;
  unit: string;
  priceFening: number;
  taxRateBp: number;
}

export interface TaxRateOption {
  id: string;
  name: string;
  rateBp: number;
  active: boolean;
}

export type InvoiceType = 'SALE' | 'ADVANCE';

export interface InvoiceFormLine {
  description: string;
  qtyMilli: number;
  unitPriceFening: number;
  discountBp: number;
  taxRateBp: number;
}

export interface InvoiceFormPayload {
  customerId: string;
  type: InvoiceType;
  issueDate: string;
  dueDate: string;
  paymentMethod?: string;
  note?: string;
  lines: InvoiceFormLine[];
}

export interface InvoiceActionResult {
  id?: string;
  error?: string;
}

/** Vrijednosti jedne linije u editoru — sve kao tekstualni unos (decimalno). */
export interface InvoiceEditorLine {
  description: string;
  qty: string;
  price: string;
  discountPercent: string;
  taxPercent: string;
}

export interface InvoiceEditorInitial {
  id: string;
  customerId: string;
  type: InvoiceType;
  issueDate: string;
  dueDate: string;
  paymentMethod: string;
  note: string;
  lines: InvoiceEditorLine[];
}

/** `yyyy-mm-dd` (iz `<input type="date">`) → ISO datetime koji API prihvata. */
export function toApiDateTime(dateInput: string): string {
  return new Date(`${dateInput}T12:00:00.000Z`).toISOString();
}

/** ISO datetime → `yyyy-mm-dd` u zoni Europe/Sarajevo (isti prikaz kao PDF). */
export function toDateInputValue(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sarajevo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Tekući datum kao `yyyy-mm-dd` (za default vrijednosti). */
export function todayInputValue(): string {
  return toDateInputValue(new Date().toISOString());
}

/** Dodaje dane na `yyyy-mm-dd` i vraća isti format. */
export function addDaysInputValue(dateInput: string, days: number): string {
  const date = new Date(`${dateInput}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

/** Količina (decimalno) → `qtyMilli`; null ako unos nije validan. */
export function parseQtyToMilli(value: string): number | null {
  const parsed = normalizeDecimal(value);
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 1000);
}

/** Cijena u KM (decimalno) → fening; null ako unos nije validan. */
export function parsePriceToFening(value: string): number | null {
  const parsed = normalizeDecimal(value);
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

/** Procenat (decimalno) → bazni poeni (17 % → 1700); null ako je van 0–100. */
export function parsePercentToBp(value: string): number | null {
  const parsed = normalizeDecimal(value);
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function feningToPriceInput(fening: number): string {
  return (fening / 100).toFixed(2);
}

export function qtyMilliToInput(qtyMilli: number): string {
  return (qtyMilli / 1000).toString();
}

export function taxRateBpToPercentInput(rateBp: number): string {
  return (rateBp / 100).toString();
}
