import { apiRequest } from './client';

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  status: string;
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

export function listInvoices(
  params: { status?: string; limit?: number } = {},
): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  const suffix = query.toString();
  return apiRequest<InvoiceListResponse>(`/invoices${suffix ? `?${suffix}` : ''}`);
}
