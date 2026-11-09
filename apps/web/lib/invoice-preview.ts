/**
 * Live obračun fakture u web editoru — ista pravila kao API (§7.2 / §7.3).
 *
 * Izvor istine je `apps/api/src/modules/invoices/invoice-calculator.ts`;
 * ovdje se isti algoritam ponavlja u BigInt-u da pregled prije čuvanja
 * pokaže identične iznose (half-up zaokruživanje na cijeli fening).
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
