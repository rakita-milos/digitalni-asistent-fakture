'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { convertInvoiceAction } from './actions';

interface ConvertInvoiceButtonProps {
  invoiceId: string;
}

/** M-09 — konverzija draft PRAČUNA u draft račun. */
export function ConvertInvoiceButton({ invoiceId }: ConvertInvoiceButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConvert(): void {
    setError(null);
    startTransition(async () => {
      const result = await convertInvoiceAction(invoiceId);

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
        onClick={handleConvert}
        disabled={isPending}
        className="rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'Konverzija…' : 'Konvertuj u račun'}
      </button>
      {error ? <p className="mt-2 max-w-xs text-xs text-danger">{error}</p> : null}
    </div>
  );
}
