import { apiRequest } from './client';

export interface ReceivablesBucket {
  key: string;
  count: number;
  amountFening: number;
}

export interface ReceivablesReport {
  asOf: string;
  buckets: ReceivablesBucket[];
  totalOutstandingFening: number;
  invoiceCount: number;
}

export function getReceivables(): Promise<ReceivablesReport> {
  return apiRequest<ReceivablesReport>('/reports/receivables');
}
