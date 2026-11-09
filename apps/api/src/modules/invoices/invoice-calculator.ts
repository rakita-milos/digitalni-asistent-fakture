import type { InvoiceLineInput } from '@digitalni-asistent/shared';

/**
 * Obračun fakture — MASTER PROMPT §7.2 i §7.3, isključivo u cijelim feningima.
 *
 * base     = qty * price            (qty_milli / 1000 * unit_price_fening)
 * discount = base * discount_bp / 10000
 * net      = base - discount
 * tax      = net * tax_rate_bp / 10000
 * total    = net + tax
 *
 * Zaokruživanje: half-up na cijeli fening (BigInt aritmetika, bez float grešaka).
 */

export interface CalculatedInvoiceLine {
  position: number;
  description: string;
  qtyMilli: number;
  unitPriceFening: bigint;
  discountBp: number;
  taxRateBp: number;
  lineSubtotalFening: bigint;
  lineTaxFening: bigint;
  lineTotalFening: bigint;
}

export interface InvoiceTotals {
  subtotalFening: bigint;
  taxFening: bigint;
  totalFening: bigint;
}

/** Half-up dijeljenje nenegativnih cijelih brojeva: (2a + b) / 2b. */
export function divRoundHalfUp(value: bigint, divisor: bigint): bigint {
  if (value < 0n) {
    throw new Error('divRoundHalfUp prima samo nenegativne vrijednosti');
  }
  if (divisor <= 0n) {
    throw new Error('Djelilac mora biti pozitivan');
  }
  return (value * 2n + divisor) / (divisor * 2n);
}

export function calculateLine(input: InvoiceLineInput, position: number): CalculatedInvoiceLine {
  const base = divRoundHalfUp(BigInt(input.qtyMilli) * BigInt(input.unitPriceFening), 1000n);
  const discount = divRoundHalfUp(base * BigInt(input.discountBp), 10000n);
  const net = base - discount;
  const tax = divRoundHalfUp(net * BigInt(input.taxRateBp), 10000n);

  return {
    position,
    description: input.description,
    qtyMilli: input.qtyMilli,
    unitPriceFening: BigInt(input.unitPriceFening),
    discountBp: input.discountBp,
    taxRateBp: input.taxRateBp,
    lineSubtotalFening: net,
    lineTaxFening: tax,
    lineTotalFening: net + tax,
  };
}

export function calculateLines(inputs: InvoiceLineInput[]): CalculatedInvoiceLine[] {
  return inputs.map((input, index) => calculateLine(input, index + 1));
}

export function calculateInvoiceTotals(lines: CalculatedInvoiceLine[]): InvoiceTotals {
  return lines.reduce<InvoiceTotals>(
    (totals, line) => ({
      subtotalFening: totals.subtotalFening + line.lineSubtotalFening,
      taxFening: totals.taxFening + line.lineTaxFening,
      totalFening: totals.totalFening + line.lineTotalFening,
    }),
    { subtotalFening: 0n, taxFening: 0n, totalFening: 0n },
  );
}
