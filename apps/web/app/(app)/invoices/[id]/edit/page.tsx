import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import {
  qtyMilliToInput,
  feningToPriceInput,
  taxRateBpToPercentInput,
  toDateInputValue,
} from '@/lib/invoice-form';
import type {
  CustomerOption,
  InvoiceEditorInitial,
  InvoiceType,
  ItemOption,
  TaxRateOption,
} from '@/lib/invoice-form';

import { InvoiceEditor } from '../../invoice-editor';

interface ListDto<T> {
  items: T[];
  total: number;
}

interface InvoiceDetailDto {
  id: string;
  number: string;
  status: string;
  type: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  paymentMethod: string | null;
  note: string | null;
  lines: Array<{
    description: string;
    qtyMilli: number;
    unitPriceFening: number;
    discountBp: number;
    taxRateBp: number;
  }>;
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let invoice: InvoiceDetailDto;
  let customers: ListDto<CustomerOption>;
  let items: ListDto<ItemOption>;
  let taxRates: ListDto<TaxRateOption>;

  try {
    [invoice, customers, items, taxRates] = await Promise.all([
      apiFetch<InvoiceDetailDto>(`/invoices/${id}`),
      apiFetch<ListDto<CustomerOption>>('/customers?limit=100'),
      apiFetch<ListDto<ItemOption>>('/items?limit=100'),
      apiFetch<ListDto<TaxRateOption>>('/tax-rates'),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        redirect('/login');
      }
      if (error.status === 404) {
        notFound();
      }
    }
    throw error;
  }

  // PATCH je dozvoljen samo za DRAFT (§7.4).
  if (invoice.status !== 'DRAFT') {
    redirect(`/invoices/${invoice.id}`);
  }

  const initial: InvoiceEditorInitial = {
    id: invoice.id,
    customerId: invoice.customerId,
    type: (invoice.type === 'ADVANCE' ? 'ADVANCE' : 'SALE') as InvoiceType,
    issueDate: toDateInputValue(invoice.issueDate),
    dueDate: toDateInputValue(invoice.dueDate),
    paymentMethod: invoice.paymentMethod ?? '',
    note: invoice.note ?? '',
    lines: invoice.lines.map((line) => ({
      description: line.description,
      qty: qtyMilliToInput(line.qtyMilli),
      price: feningToPriceInput(line.unitPriceFening),
      discountPercent: (line.discountBp / 100).toString(),
      taxPercent: taxRateBpToPercentInput(line.taxRateBp),
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Izmjena drafta {invoice.number}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Izmjene su dozvoljene samo dok je faktura u statusu Draft.
          </p>
        </div>
        <Link href={`/invoices/${invoice.id}`} className="text-sm text-foreground/60 hover:text-primary">
          ← Detalj
        </Link>
      </div>

      <InvoiceEditor
        mode="edit"
        initial={initial}
        customers={customers.items}
        items={items.items}
        taxRates={taxRates.items}
        defaultDueDays={0}
      />
    </div>
  );
}
