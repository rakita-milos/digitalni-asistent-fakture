import Link from 'next/link';
import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import { formatDate, formatFening, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';

interface InvoiceSummary {
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

interface InvoiceList {
  items: InvoiceSummary[];
  total: number;
}

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

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-foreground/60">
            <tr>
              <th className="px-4 py-3">Broj</th>
              <th className="px-4 py-3">Kupac</th>
              <th className="px-4 py-3">Rok</th>
              <th className="px-4 py-3 text-right">Iznos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground/50">
                  Nema faktura.
                </td>
              </tr>
            ) : (
              data.items.map((invoice) => (
                <tr key={invoice.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="hover:text-primary hover:underline">
                      {invoice.number}
                    </Link>
                    {invoice.type === 'ADVANCE' ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        PRAČUN
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{invoice.customer.name}</td>
                  <td className="px-4 py-3 text-foreground/60">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3 text-right">{formatFening(invoice.totalFening)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLES[invoice.status] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {STATUS_LABELS[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
