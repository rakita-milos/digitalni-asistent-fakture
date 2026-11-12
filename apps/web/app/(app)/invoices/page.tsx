import Link from 'next/link';
import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';

import { InvoiceTable } from './invoice-table';
import type { InvoiceList } from './types';

export default async function InvoicesPage() {
  let data: InvoiceList;

  try {
    data = await apiFetch<InvoiceList>('/invoices?limit=50');
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fakture</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/50">Ukupno: {data.total}</span>
          <Link
            href="/invoices/new"
            className="rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Nova faktura
          </Link>
        </div>
      </div>

      <InvoiceTable items={data.items} />
    </div>
  );
}
