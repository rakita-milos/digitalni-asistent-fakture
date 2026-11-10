'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';
import type { InvoiceActionResult, InvoiceFormPayload } from '@/lib/invoice-form';

/**
 * Server akcije za web editor fakture (W-04).
 * Sav poslovni obračun radi API; web samo prosljeđuje unos i prikazuje greške.
 */

function toActionResult(error: unknown, fallback: string): InvoiceActionResult {
  if (error instanceof ApiFailure) {
    if (error.status === 401) {
      redirect('/login');
    }
    return { error: error.message };
  }

  return { error: fallback };
}

export async function createInvoiceAction(
  payload: InvoiceFormPayload,
  idempotencyKey?: string,
): Promise<InvoiceActionResult> {
  try {
    const invoice = await apiFetch<{ id: string }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...(idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : {}),
    });

    revalidatePath('/invoices');
    return { id: invoice.id };
  } catch (error) {
    return toActionResult(error, 'Faktura nije sačuvana.');
  }
}

export async function updateInvoiceAction(
  invoiceId: string,
  payload: InvoiceFormPayload,
): Promise<InvoiceActionResult> {
  try {
    const invoice = await apiFetch<{ id: string }>(`/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return { id: invoice.id };
  } catch (error) {
    return toActionResult(error, 'Izmjene nisu sačuvane.');
  }
}

export async function issueInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ id: string }>(`/invoices/${invoiceId}/issue`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Faktura nije izdata.');
  }
}

/** M-09: draft PRAČUN postaje draft račun. */
export async function convertInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ id: string }>(`/invoices/${invoiceId}/convert`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'PRAČUN nije konvertovan.');
  }
}
