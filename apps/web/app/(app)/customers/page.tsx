import Link from 'next/link';
import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';

import type { CustomerList } from './types';

interface CustomersSearchParams {
  [key: string]: string | string[] | undefined;
}

function readQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;

  return (raw ?? '').trim();
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  const params = await searchParams;
  const q = readQuery(params.q);

  const query = new URLSearchParams({ limit: '100' });
  if (q) {
    query.set('q', q);
  }

  let data: CustomerList;

  try {
    data = await apiFetch<CustomerList>(`/customers?${query.toString()}`);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kupci</h1>
          <p className="mt-1 text-sm text-foreground/60">Ukupno: {data.total}</p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Novi kupac
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm text-foreground/60">
            Pretraga
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Naziv, JIB, telefon ili email"
            className="w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Traži
        </button>
        {q ? (
          <Link href="/customers" className="px-2 py-2 text-sm text-foreground/60 hover:text-primary">
            Očisti
          </Link>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-foreground/60">
            <tr>
              <th className="px-4 py-3">Naziv</th>
              <th className="px-4 py-3">JIB</th>
              <th className="px-4 py-3">Grad</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground/50">
                  Nema kupaca.
                </td>
              </tr>
            ) : (
              data.items.map((customer) => (
                <tr key={customer.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{customer.name}</td>
                  <td className="px-4 py-3 text-foreground/60">{customer.jib ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground/60">{customer.city ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground/60">{customer.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground/60">{customer.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${customer.id}`} className="text-primary hover:underline">
                      Detalji
                    </Link>
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
