import { redirect } from 'next/navigation';

import { apiFetch, ApiFailure } from '@/lib/api';
import { BUCKET_LABELS, formatDate, formatFening } from '@/lib/format';

interface ReceivablesBucket {
  key: string;
  count: number;
  amountFening: number;
}

interface ReceivablesReport {
  asOf: string;
  buckets: ReceivablesBucket[];
  totalOutstandingFening: number;
  invoiceCount: number;
}

interface MonthlyRow {
  month: number;
  issuedCount: number;
  invoicedFening: number;
  paidFening: number;
}

interface MonthlyReport {
  year: number;
  months: MonthlyRow[];
}

interface ReportsSearchParams {
  [key: string]: string | string[] | undefined;
}

const MONTH_LABELS = [
  'Januar',
  'Februar',
  'Mart',
  'April',
  'Maj',
  'Jun',
  'Jul',
  'Avgust',
  'Septembar',
  'Oktobar',
  'Novembar',
  'Decembar',
] as const;

const DEFAULT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

function parseYear(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

  if (Number.isInteger(parsed) && parsed >= MIN_YEAR && parsed <= MAX_YEAR) {
    return parsed;
  }

  return DEFAULT_YEAR;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>;
}) {
  const params = await searchParams;
  const year = parseYear(params.year);

  let receivables: ReceivablesReport;
  let monthly: MonthlyReport;

  try {
    [receivables, monthly] = await Promise.all([
      apiFetch<ReceivablesReport>('/reports/receivables'),
      apiFetch<MonthlyReport>(`/reports/monthly?year=${year}`),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  const agingTotal = receivables.buckets.reduce(
    (total, bucket) => ({
      count: total.count + bucket.count,
      amountFening: total.amountFening + bucket.amountFening,
    }),
    { count: 0, amountFening: 0 },
  );

  const monthlyRows = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const row = monthly.months.find((entry) => entry.month === month);

    return {
      month,
      label,
      issuedCount: row?.issuedCount ?? 0,
      invoicedFening: row?.invoicedFening ?? 0,
      paidFening: row?.paidFening ?? 0,
    };
  });

  const monthlyTotal = monthlyRows.reduce(
    (total, row) => ({
      issuedCount: total.issuedCount + row.issuedCount,
      invoicedFening: total.invoicedFening + row.invoicedFening,
      paidFening: total.paidFening + row.paidFening,
    }),
    { issuedCount: 0, invoicedFening: 0, paidFening: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Izvještaji</h1>
        <p className="text-sm text-foreground/60">Aging potraživanja i mjesečni pregled fakturisanja.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-foreground/50">Ukupno nenaplaćeno</p>
          <p className="mt-1 text-3xl font-bold">{formatFening(receivables.totalOutstandingFening)}</p>
          <p className="mt-1 text-xs text-foreground/40">Stanje na dan {formatDate(receivables.asOf)}</p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-foreground/50">Broj faktura</p>
          <p className="mt-1 text-3xl font-bold">{receivables.invoiceCount}</p>
          <p className="mt-1 text-xs text-foreground/40">Fakture sa otvorenim potraživanjem</p>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Aging potraživanja</h2>

        {receivables.invoiceCount === 0 ? (
          <p className="mt-3 text-sm text-foreground/50">Nema potraživanja.</p>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-foreground/60">
              <tr>
                <th className="px-4 py-3">Raspon</th>
                <th className="px-4 py-3 text-right">Broj faktura</th>
                <th className="px-4 py-3 text-right">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {receivables.buckets.map((bucket) => (
                <tr key={bucket.key} className="border-t border-black/5">
                  <td className="px-4 py-3">{BUCKET_LABELS[bucket.key] ?? bucket.key}</td>
                  <td className="px-4 py-3 text-right">{bucket.count}</td>
                  <td className="px-4 py-3 text-right">{formatFening(bucket.amountFening)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/5 font-semibold">
                <td className="px-4 py-3">Ukupno</td>
                <td className="px-4 py-3 text-right">{agingTotal.count}</td>
                <td className="px-4 py-3 text-right">{formatFening(agingTotal.amountFening)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Mjesečni izvještaj</h2>
            <p className="text-sm text-foreground/50">Izdato i naplaćeno po mjesecima za {monthly.year}.</p>
          </div>

          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="year" className="mb-1 block text-sm text-foreground/60">
                Godina
              </label>
              <input
                id="year"
                type="number"
                name="year"
                min={MIN_YEAR}
                max={MAX_YEAR}
                defaultValue={year}
                className="w-28 rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Prikaži
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-foreground/60">
              <tr>
                <th className="px-4 py-3">Mjesec</th>
                <th className="px-4 py-3 text-right">Broj izdatih</th>
                <th className="px-4 py-3 text-right">Fakturisano</th>
                <th className="px-4 py-3 text-right">Naplaćeno</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((row) => (
                <tr key={row.month} className="border-t border-black/5">
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="px-4 py-3 text-right">{row.issuedCount}</td>
                  <td className="px-4 py-3 text-right">{formatFening(row.invoicedFening)}</td>
                  <td className="px-4 py-3 text-right">{formatFening(row.paidFening)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/5 font-semibold">
                <td className="px-4 py-3">Ukupno</td>
                <td className="px-4 py-3 text-right">{monthlyTotal.issuedCount}</td>
                <td className="px-4 py-3 text-right">{formatFening(monthlyTotal.invoicedFening)}</td>
                <td className="px-4 py-3 text-right">{formatFening(monthlyTotal.paidFening)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
