import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import { formatDate, formatFening } from '@/lib/format';

import { archiveCustomerAction, updateCustomerAction } from '../actions';
import { CustomerForm } from '../customer-form';
import type { Customer } from '../types';

interface InvoiceSummary {
  id: string;
  status: string;
  totalFening: number;
  paidFening: number;
}

interface InvoiceList {
  items: InvoiceSummary[];
  total: number;
}

/** Statusi koji predstavljaju otvoreno potraživanje (§7). */
const OUTSTANDING_STATUSES = new Set(['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']);

function valueOrDash(value: string | null): string {
  return value ?? '—';
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let customer: Customer;
  let invoices: InvoiceList;

  try {
    [customer, invoices] = await Promise.all([
      apiFetch<Customer>(`/customers/${encodeURIComponent(id)}`),
      apiFetch<InvoiceList>(`/invoices?customerId=${encodeURIComponent(id)}&limit=100`),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        redirect('/login');
      }
      if (error.status === 400 || error.status === 404) {
        notFound();
      }
    }
    throw error;
  }

  const outstandingInvoices = invoices.items.filter((invoice) =>
    OUTSTANDING_STATUSES.has(invoice.status),
  );
  const outstandingFening = outstandingInvoices.reduce(
    (sum, invoice) => sum + invoice.totalFening - invoice.paidFening,
    0,
  );
  const isArchived = customer.archivedAt !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            {isArchived ? (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                Arhiviran
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-foreground/60">
            {valueOrDash(customer.city)} · {valueOrDash(customer.phone)} · {valueOrDash(customer.email)}
          </p>
        </div>
        <Link href="/customers" className="text-sm text-foreground/60 hover:text-primary">
          ← Kupci
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">JIB</p>
          <p className="mt-1 font-medium">{valueOrDash(customer.jib)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Grad</p>
          <p className="mt-1 font-medium">{valueOrDash(customer.city)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Telefon</p>
          <p className="mt-1 font-medium">{valueOrDash(customer.phone)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Nenaplaćeno</p>
          <p className="mt-1 font-medium">{formatFening(outstandingFening)}</p>
          <p className="mt-0.5 text-xs text-foreground/40">
            {outstandingInvoices.length} od {invoices.total} faktura
          </p>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold">Podaci o kupcu</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-foreground/50">JIB</dt>
            <dd>{valueOrDash(customer.jib)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">PIB / PDV broj</dt>
            <dd>{valueOrDash(customer.vatId)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Adresa</dt>
            <dd>{valueOrDash(customer.address)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Grad</dt>
            <dd>{valueOrDash(customer.city)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Telefon</dt>
            <dd>{valueOrDash(customer.phone)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Email</dt>
            <dd>{valueOrDash(customer.email)}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Arhiviran</dt>
            <dd>{customer.archivedAt ? formatDate(customer.archivedAt) : '—'}</dd>
          </div>
          {customer.note ? (
            <div className="sm:col-span-2">
              <dt className="text-foreground/50">Napomena</dt>
              <dd className="mt-1 rounded-[var(--radius-button)] bg-black/[0.03] p-3 text-foreground/70">
                {customer.note}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold">Izmjena podataka</h2>
        <CustomerForm
          action={updateCustomerAction.bind(null, customer.id)}
          submitLabel="Sačuvaj izmjene"
          pendingLabel="Čuvanje…"
          cancelHref={`/customers/${customer.id}`}
          customer={customer}
        />
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Arhiviranje</h2>
        {isArchived ? (
          <p className="mt-2 text-sm text-foreground/60">
            Kupac je arhiviran i ne prikazuje se u listi kupaca.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-foreground/60">
              Arhivirani kupac se sklanja iz liste, ali ostaje sačuvan sa svojim fakturama.
            </p>
            <form action={archiveCustomerAction.bind(null, customer.id)} className="mt-4">
              <button
                type="submit"
                className="rounded-[var(--radius-button)] border border-[color:var(--color-danger)] px-4 py-2 text-sm font-semibold text-danger hover:bg-red-50"
              >
                Arhiviraj
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
