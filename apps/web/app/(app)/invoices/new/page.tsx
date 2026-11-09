import Link from 'next/link';
import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import type { CustomerOption, ItemOption, TaxRateOption } from '@/lib/invoice-form';

import { InvoiceEditor } from '../invoice-editor';

interface ListDto<T> {
  items: T[];
  total: number;
}

interface CompanyDto {
  defaultDueDays: number;
}

export default async function NewInvoicePage() {
  let customers: ListDto<CustomerOption>;
  let items: ListDto<ItemOption>;
  let taxRates: ListDto<TaxRateOption>;
  let company: CompanyDto;

  try {
    [customers, items, taxRates, company] = await Promise.all([
      apiFetch<ListDto<CustomerOption>>('/customers?limit=100'),
      apiFetch<ListDto<ItemOption>>('/items?limit=100'),
      apiFetch<ListDto<TaxRateOption>>('/tax-rates'),
      apiFetch<CompanyDto>('/company'),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nova faktura</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Faktura se čuva kao draft; broj i fiskalizacija dolaze na „Izdaj“.
          </p>
        </div>
        <Link href="/invoices" className="text-sm text-foreground/60 hover:text-primary">
          ← Fakture
        </Link>
      </div>

      <InvoiceEditor
        mode="create"
        customers={customers.items}
        items={items.items}
        taxRates={taxRates.items}
        defaultDueDays={company.defaultDueDays}
      />
    </div>
  );
}
