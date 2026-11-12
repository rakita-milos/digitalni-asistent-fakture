'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { formatDate, formatFening, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';
import { canBulkIssue, canBulkRemind } from '@/lib/invoice-bulk';

import {
  bulkIssueInvoicesAction,
  bulkRemindInvoicesAction,
  type BulkActionResult,
} from './actions';
import type { InvoiceSummary } from './types';

interface InvoiceTableProps {
  items: InvoiceSummary[];
}

/** W-03: tabela faktura sa selekcijom i masovnim akcijama (izdavanje / podsjetnici). */
export function InvoiceTable({ items }: InvoiceTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedItems = items.filter((invoice) => selected.has(invoice.id));
  const issueIds = selectedItems.filter(canBulkIssue).map((invoice) => invoice.id);
  const remindIds = selectedItems.filter(canBulkRemind).map((invoice) => invoice.id);
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setResult(null);
    setError(null);
  }

  function toggleAll(): void {
    setSelected(allSelected ? new Set() : new Set(items.map((invoice) => invoice.id)));
    setResult(null);
    setError(null);
  }

  function run(action: 'issue' | 'remind'): void {
    const ids = action === 'issue' ? issueIds : remindIds;
    if (ids.length === 0) {
      return;
    }

    const label = action === 'issue' ? 'izdati' : 'poslati podsjetnik za';
    if (!window.confirm(`Da li želite ${label} ${ids.length} faktura?`)) {
      return;
    }

    setError(null);
    setResult(null);

    startTransition(async () => {
      const response =
        action === 'issue'
          ? await bulkIssueInvoicesAction(ids)
          : await bulkRemindInvoicesAction(ids);

      if (response.error) {
        setError(response.error);
        return;
      }

      setResult(response);
      setSelected(new Set());
      router.refresh();
    });
  }

  function failureLabel(id: string, errorMessage: string): string {
    const invoice = items.find((candidate) => candidate.id === id);
    return `${invoice?.number ?? id}: ${errorMessage}`;
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 text-sm shadow-sm ring-1 ring-black/5">
          <span className="text-foreground/70">Izabrano: {selected.size}</span>
          <button
            type="button"
            data-testid="bulk-issue"
            onClick={() => run('issue')}
            disabled={isPending || issueIds.length === 0}
            className="rounded-[var(--radius-button)] bg-primary px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            Izdaj izabrane ({issueIds.length})
          </button>
          <button
            type="button"
            data-testid="bulk-remind"
            onClick={() => run('remind')}
            disabled={isPending || remindIds.length === 0}
            className="rounded-[var(--radius-button)] border border-primary px-3 py-1.5 font-semibold text-primary disabled:opacity-50"
          >
            Pošalji podsjetnik ({remindIds.length})
          </button>
          <button
            type="button"
            onClick={toggleAll}
            disabled={isPending}
            className="text-sm text-foreground/60 hover:text-primary"
          >
            Očisti izbor
          </button>
          <span className="text-xs text-foreground/50">
            Izdaju se samo draft računi; podsjetnik ide za izdate i neplaćene.
          </span>
        </div>
      ) : null}

      {isPending ? <p className="text-sm text-foreground/60">Akcija u toku…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {result ? (
        <div data-testid="bulk-result" className="rounded-[var(--radius-button)] bg-green-50 p-3 text-sm text-green-900">
          <p>
            Uspješno: {result.succeeded}/{result.total}.
          </p>
          {result.failed.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-xs text-danger">
              {result.failed.slice(0, 10).map((failure) => (
                <li key={failure.id}>{failureLabel(failure.id, failure.error)}</li>
              ))}
              {result.failed.length > 10 ? <li>… i još {result.failed.length - 10}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-foreground/60">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  data-testid="invoice-select-all"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Izaberi sve fakture"
                />
              </th>
              <th className="px-4 py-3">Broj</th>
              <th className="px-4 py-3">Kupac</th>
              <th className="px-4 py-3">Rok</th>
              <th className="px-4 py-3 text-right">Iznos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-foreground/50">
                  Nema faktura.
                </td>
              </tr>
            ) : (
              items.map((invoice) => (
                <tr key={invoice.id} className="border-t border-black/5">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      data-testid={`invoice-select-${invoice.id}`}
                      checked={selected.has(invoice.id)}
                      onChange={() => toggle(invoice.id)}
                      aria-label={`Izaberi fakturu ${invoice.number}`}
                    />
                  </td>
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
