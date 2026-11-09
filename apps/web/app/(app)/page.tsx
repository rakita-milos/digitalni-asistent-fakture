import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import { BUCKET_LABELS, formatFening } from '@/lib/format';

interface Company {
  name: string;
  jib: string;
}

interface Receivables {
  buckets: Array<{ key: string; count: number; amountFening: number }>;
  totalOutstandingFening: number;
  invoiceCount: number;
}

export default async function DashboardPage() {
  let company: Company;
  let report: Receivables;

  try {
    [company, report] = await Promise.all([
      apiFetch<Company>('/company'),
      apiFetch<Receivables>('/reports/receivables'),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-foreground/60">JIB: {company.jib}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-foreground/50">Ukupno nenaplaćeno</p>
          <p className="mt-1 text-3xl font-bold">{formatFening(report.totalOutstandingFening)}</p>
          <p className="mt-1 text-xs text-foreground/40">{report.invoiceCount} faktura</p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="mb-3 text-sm text-foreground/50">Aging potraživanja</p>
          <ul className="space-y-2 text-sm">
            {report.buckets.map((bucket) => (
              <li key={bucket.key} className="flex justify-between">
                <span className="text-foreground/70">{BUCKET_LABELS[bucket.key] ?? bucket.key}</span>
                <span className="font-medium">
                  {formatFening(bucket.amountFening)}
                  {bucket.count > 0 ? ` (${bucket.count})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
