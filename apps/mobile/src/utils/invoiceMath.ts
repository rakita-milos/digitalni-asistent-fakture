/**
 * Obračun fakture u mobilnoj formi — ista pravila kao API (§7.2 / §7.3).
 *
 * Izvor istine je `apps/api/src/modules/invoices/invoice-calculator.ts`;
 * pregled prije slanja koristi isti BigInt + half-up algoritam, pa se
 * iznosi u formi poklapaju sa onim što API izračuna.
 */

export interface InvoicePreviewInput {
  qtyMilli: number;
  unitPriceFening: number;
  discountBp: number;
  taxRateBp: number;
}

export interface InvoicePreviewLine {
  subtotalFening: number;
  taxFening: number;
  totalFening: number;
}

export interface InvoicePreviewTotals {
  subtotalFening: number;
  taxFening: number;
  totalFening: number;
}

/** Half-up dijeljenje nenegativnih cijelih brojeva: (2a + b) / 2b. */
function divRoundHalfUp(value: bigint, divisor: bigint): bigint {
  return (value * 2n + divisor) / (divisor * 2n);
}

export function calculatePreviewLine(input: InvoicePreviewInput): InvoicePreviewLine {
  const base = divRoundHalfUp(BigInt(input.qtyMilli) * BigInt(input.unitPriceFening), 1000n);
  const discount = divRoundHalfUp(base * BigInt(input.discountBp), 10000n);
  const net = base - discount;
  const tax = divRoundHalfUp(net * BigInt(input.taxRateBp), 10000n);

  return {
    subtotalFening: Number(net),
    taxFening: Number(tax),
    totalFening: Number(net + tax),
  };
}

export function calculatePreviewTotals(lines: InvoicePreviewInput[]): InvoicePreviewTotals {
  return lines.reduce<InvoicePreviewTotals>(
    (totals, line) => {
      const preview = calculatePreviewLine(line);
      return {
        subtotalFening: totals.subtotalFening + preview.subtotalFening,
        taxFening: totals.taxFening + preview.taxFening,
        totalFening: totals.totalFening + preview.totalFening,
      };
    },
    { subtotalFening: 0, taxFening: 0, totalFening: 0 },
  );
}

function normalizeDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

/** Količina (decimalno) → `qtyMilli`; null ako unos nije validan. */
export function parseQtyMilli(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = normalizeDecimal(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const milli = Math.round(parsed * 1000);
  return milli >= 1 ? milli : null;
}

/** Cijena u KM → fening; null ako unos nije validan. */
export function parsePriceFening(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = normalizeDecimal(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

/** Procenat → bazni poeni (17 % → 1700); null ako je van 0–100. */
export function parsePercentBp(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = normalizeDecimal(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function feningToPriceInput(fening: number): string {
  return (fening / 100).toFixed(2);
}

export function taxRateBpToPercentInput(rateBp: number): string {
  return (rateBp / 100).toString();
}

export function qtyMilliToInput(qtyMilli: number): string {
  return (qtyMilli / 1000).toString();
}

/** `yyyy-mm-dd` → ISO datetime koji API prihvata. */
export function toApiDateTime(dateInput: string): string {
  return new Date(`${dateInput}T12:00:00.000Z`).toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Današnji datum kao `yyyy-mm-dd` (lokalno). */
export function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Dodaje dane na `yyyy-mm-dd` i vraća isti format. */
export function addDaysInput(dateInput: string, days: number): string {
  const date = new Date(`${dateInput}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Provjera formata i validnosti `yyyy-mm-dd` datuma. */
export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime());
}
