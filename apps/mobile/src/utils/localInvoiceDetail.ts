import type { InvoiceDetailDto } from '../api/invoices';
import { calculatePreviewLine } from './invoiceMath';
import { formatLocalDraftNumber } from './localInvoice';
import { uuidv7 } from './uuid';

/**
 * Detalj lokalno kreirane (offline) fakture za keš prikaza (M-08 offline).
 * Oblik odgovara `InvoiceDetailDto` da ga ekran detalja može renderovati isto kao server podatke.
 */

export interface LocalDraftLineInput {
  description: string;
  qtyMilli: number;
  unitPriceFening: number;
  discountBp: number;
  taxRateBp: number;
}

export interface LocalDraftDetailInput {
  id: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  note?: string;
  paymentMethod?: string;
  lines: LocalDraftLineInput[];
}

export function buildLocalDraftDetail(input: LocalDraftDetailInput): InvoiceDetailDto {
  const lines = input.lines.map((line, index) => {
    const calculated = calculatePreviewLine({
      qtyMilli: line.qtyMilli,
      unitPriceFening: line.unitPriceFening,
      discountBp: line.discountBp,
      taxRateBp: line.taxRateBp,
    });

    return {
      id: uuidv7(),
      position: index + 1,
      description: line.description,
      qtyMilli: line.qtyMilli,
      unitPriceFening: line.unitPriceFening,
      discountBp: line.discountBp,
      taxRateBp: line.taxRateBp,
      lineSubtotalFening: calculated.subtotalFening,
      lineTaxFening: calculated.taxFening,
      lineTotalFening: calculated.totalFening,
    };
  });

  const subtotalFening = lines.reduce((sum, line) => sum + line.lineSubtotalFening, 0);
  const taxFening = lines.reduce((sum, line) => sum + line.lineTaxFening, 0);
  const totalFening = lines.reduce((sum, line) => sum + line.lineTotalFening, 0);

  return {
    id: input.id,
    companyId: '',
    customerId: input.customerId,
    customer: { id: input.customerId, name: input.customerName },
    number: formatLocalDraftNumber(input.id),
    status: 'DRAFT',
    type: 'SALE',
    transactionType: 'SALE',
    currency: input.currency ?? 'BAM',
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    subtotalFening,
    taxFening,
    totalFening,
    paidFening: 0,
    note: input.note ?? null,
    paymentMethod: input.paymentMethod ?? null,
    fiscalPfr: null,
    fiscalQrPayload: null,
    fiscalAt: null,
    originalInvoiceId: null,
    lines,
    payments: [],
  };
}
