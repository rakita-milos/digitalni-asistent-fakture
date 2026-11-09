'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { issueInvoiceAction } from './actions';

interface IssueInvoiceButtonProps {
  invoiceId: string;
}

/** Dugme „Izdaj“ na detalju drafta — fiskalizacija kroz API (§7.5). */
export function IssueInvoiceButton({ invoiceId }: IssueInvoiceButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleIssue(): void {
    setError(null);
    startTransition(async () => {
      const result = await issueInvoiceAction(invoiceId);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleIssue}
        disabled={isPending}
        className="rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'Izdavanje…' : 'Izdaj i fiskalizuj'}
      </button>
      {error ? <p className="mt-2 max-w-xs text-xs text-danger">{error}</p> : null}
    </div>
  );
}
