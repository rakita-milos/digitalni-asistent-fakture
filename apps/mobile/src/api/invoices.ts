import type {
  CreateInvoiceInput,
  CreatePaymentInput,
  RefundInvoiceInput,
} from '@digitalni-asistent/shared';

import { apiRequest } from './client';

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  status: string;
  type: string;
  transactionType: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  totalFening: number;
  paidFening: number;
  customer: { id: string; name: string };
}

export interface InvoiceListResponse {
  items: InvoiceSummaryDto[];
  total: number;
}

export interface InvoiceLineDto {
  id: string;
  position: number;
  description: string;
  qtyMilli: number;
  unitPriceFening: number;
  discountBp: number;
  taxRateBp: number;
  lineSubtotalFening: number;
  lineTaxFening: number;
  lineTotalFening: number;
}

export interface PaymentDto {
  id: string;
  amountFening: number;
  method: string;
  paidAt: string;
  note: string | null;
}

/** GET /invoices/:id — detalj (§6). Iznosi su u feningu, datumi ISO stringovi. */
export interface InvoiceDetailDto extends InvoiceSummaryDto {
  subtotalFening: number;
  taxFening: number;
  note: string | null;
  paymentMethod: string | null;
  fiscalPfr: string | null;
  fiscalQrPayload: string | null;
  fiscalAt: string | null;
  originalInvoiceId: string | null;
  lines: InvoiceLineDto[];
  payments: PaymentDto[];
}

export interface PaymentResult {
  payment: PaymentDto;
  invoice: InvoiceDetailDto;
}

export function listInvoices(
  params: { status?: string; limit?: number } = {},
): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  const suffix = query.toString();
  return apiRequest<InvoiceListResponse>(`/invoices${suffix ? `?${suffix}` : ''}`);
}

export function getInvoice(id: string): Promise<InvoiceDetailDto> {
  return apiRequest<InvoiceDetailDto>(`/invoices/${id}`);
}

export function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetailDto> {
  return apiRequest<InvoiceDetailDto>('/invoices', { method: 'POST', body: input });
}

/** POST /invoices/:id/issue — fiskalizacija + dodjela broja (§7.5). */
export function issueInvoice(id: string): Promise<InvoiceDetailDto> {
  return apiRequest<InvoiceDetailDto>(`/invoices/${id}/issue`, { method: 'POST', body: {} });
}

export function createPayment(id: string, input: CreatePaymentInput): Promise<PaymentResult> {
  return apiRequest<PaymentResult>(`/invoices/${id}/payments`, { method: 'POST', body: input });
}

/** POST /invoices/:id/cancel — poništenje; vraća novi VOID dokument. */
export function cancelInvoice(id: string): Promise<InvoiceDetailDto> {
  return apiRequest<InvoiceDetailDto>(`/invoices/${id}/cancel`, { method: 'POST', body: {} });
}

/** POST /invoices/:id/refund — refundacija; vraća novi REFUND dokument (§7.7). */
export function refundInvoice(id: string, input: RefundInvoiceInput): Promise<InvoiceDetailDto> {
  return apiRequest<InvoiceDetailDto>(`/invoices/${id}/refund`, {
    method: 'POST',
    body: input,
  });
}
