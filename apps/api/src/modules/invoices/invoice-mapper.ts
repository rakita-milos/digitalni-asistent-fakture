import type {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';

/**
 * BigInt (fening) → number za JSON odgovore. Vrijednosti su daleko ispod 2^53,
 * pa je konverzija sigurna; baza ostaje egzaktna.
 */
function money(value: bigint): number {
  return Number(value);
}

export interface InvoiceLineRow {
  id: string;
  invoiceId: string;
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

export interface InvoiceSummaryRow {
  id: string;
  companyId: string;
  customerId: string;
  number: string;
  type: InvoiceType;
  transactionType: TransactionType;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotalFening: bigint;
  taxFening: bigint;
  totalFening: bigint;
  paidFening: bigint;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  customer: { id: string; name: string };
}

export interface PaymentRow {
  id: string;
  invoiceId: string;
  amountFening: bigint;
  method: PaymentMethod;
  paidAt: Date;
  note: string | null;
  createdBy: string | null;
}

export interface InvoiceDetailRow extends InvoiceSummaryRow {
  fiscalPfr: string | null;
  fiscalQrPayload: string | null;
  fiscalAt: Date | null;
  originalInvoiceId: string | null;
  createdBy: string | null;
  lines: InvoiceLineRow[];
  payments: PaymentRow[];
}

function toLineDto(line: InvoiceLineRow) {
  return {
    ...line,
    unitPriceFening: money(line.unitPriceFening),
    lineSubtotalFening: money(line.lineSubtotalFening),
    lineTaxFening: money(line.lineTaxFening),
    lineTotalFening: money(line.lineTotalFening),
  };
}

export function toInvoiceSummaryDto(invoice: InvoiceSummaryRow) {
  return {
    id: invoice.id,
    companyId: invoice.companyId,
    customerId: invoice.customerId,
    customer: invoice.customer,
    number: invoice.number,
    type: invoice.type,
    transactionType: invoice.transactionType,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotalFening: money(invoice.subtotalFening),
    taxFening: money(invoice.taxFening),
    totalFening: money(invoice.totalFening),
    paidFening: money(invoice.paidFening),
    note: invoice.note,
    paymentMethod: invoice.paymentMethod,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    version: invoice.version,
  };
}

export function toPaymentDto(payment: PaymentRow) {
  return { ...payment, amountFening: money(payment.amountFening) };
}

export function toInvoiceDetailDto(invoice: InvoiceDetailRow) {
  return {
    ...toInvoiceSummaryDto(invoice),
    fiscalPfr: invoice.fiscalPfr,
    fiscalQrPayload: invoice.fiscalQrPayload,
    fiscalAt: invoice.fiscalAt,
    originalInvoiceId: invoice.originalInvoiceId,
    createdBy: invoice.createdBy,
    lines: invoice.lines.map(toLineDto),
    payments: invoice.payments.map(toPaymentDto),
  };
}
