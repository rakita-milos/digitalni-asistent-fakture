export interface InvoiceSummary {
  id: string;
  number: string;
  type: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalFening: number;
  paidFening: number;
  customer: { id: string; name: string };
}

export interface InvoiceList {
  items: InvoiceSummary[];
  total: number;
}
