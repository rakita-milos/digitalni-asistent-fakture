/** Fiskalni adapter — ugovor prema ESIR-u (model TBD do odgovora operatera, G0). */
export const FISCAL_ADAPTER = 'FISCAL_ADAPTER';

export interface FiscalInvoiceLine {
  description: string;
  qtyMilli: number;
  unitPriceFening: number;
  taxRateBp: number;
  lineTotalFening: number;
}

export interface FiscalInvoiceData {
  number: string;
  type: 'SALE' | 'ADVANCE';
  /** ISO 8601 (UTC). */
  issueDate: string;
  currency: string;
  subtotalFening: number;
  taxFening: number;
  totalFening: number;
  company: { name: string; jib: string; efdId: string | null };
  lines: FiscalInvoiceLine[];
}

export interface FiscalResult {
  /** PFR — jedinstveni broj fiskalnog računa koji vraća ESIR. */
  pfr: string;
  /** Sadržaj QR koda na računu (§11). */
  qrPayload: string;
  request: unknown;
  response: unknown;
}

export interface FiscalAdapter {
  issue(data: FiscalInvoiceData): Promise<FiscalResult>;
}
