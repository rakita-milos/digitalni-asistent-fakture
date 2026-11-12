'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';
import type { InvoiceActionResult, InvoiceFormPayload } from '@/lib/invoice-form';
import { BULK_LIMIT } from '@/lib/invoice-bulk';

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

export interface PaymentActionInput {
  amountFening: number;
  method: string;
  note?: string;
}

export async function createPaymentAction(
  invoiceId: string,
  input: PaymentActionInput,
): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ payment: unknown }>(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Naplata nije sačuvana.');
  }
}

export interface RefundActionInput {
  amountFening: number;
  note?: string;
}

export async function refundInvoiceAction(
  invoiceId: string,
  input: RefundActionInput,
): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ id: string }>(`/invoices/${invoiceId}/refund`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Refundacija nije sačuvana.');
  }
}

export async function cancelInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ id: string }>(`/invoices/${invoiceId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Faktura nije poništena.');
  }
}

export async function sendReminderAction(invoiceId: string): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ id: string }>(`/invoices/${invoiceId}/remind`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Podsjetnik nije poslan.');
  }
}

export interface SendInvoiceActionInput {
  channel: 'EMAIL' | 'SMS';
  to?: string;
}

/** §6: slanje fakture e-mailom (PDF) ili SMS-om (kratkotrajni link). */
export async function sendInvoiceAction(
  invoiceId: string,
  input: SendInvoiceActionInput,
): Promise<InvoiceActionResult> {
  try {
    await apiFetch<{ sent: true }>(`/invoices/${invoiceId}/send`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath(`/invoices/${invoiceId}`);
    return {};
  } catch (error) {
    return toActionResult(error, 'Faktura nije poslana.');
  }
}

export interface BulkActionResult {
  total: number;
  succeeded: number;
  failed: Array<{ id: string; error: string }>;
  error?: string;
}

/**
 * W-03 masovne akcije: po jedan postojeći API poziv po fakturi (nema bulk rute van §6).
 * Greška jedne fakture ne prekida ostale; rezultat se vraća po fakturi.
 */
async function runBulkAction(
  ids: string[],
  endpoint: (id: string) => string,
  fallbackError: string,
): Promise<BulkActionResult> {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return { total: 0, succeeded: 0, failed: [], error: 'Nije izabrana nijedna faktura.' };
  }
  if (uniqueIds.length > BULK_LIMIT) {
    return {
      total: uniqueIds.length,
      succeeded: 0,
      failed: [],
      error: `Najviše ${BULK_LIMIT} faktura može ići u jednoj akciji.`,
    };
  }

  let succeeded = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of uniqueIds) {
    try {
      await apiFetch<unknown>(endpoint(id), {
        method: 'POST',
        body: JSON.stringify({}),
      });
      succeeded += 1;
    } catch (error) {
      if (error instanceof ApiFailure) {
        if (error.status === 401) {
          redirect('/login');
        }
        failed.push({ id, error: error.message });
      } else {
        failed.push({ id, error: fallbackError });
      }
    }
  }

  revalidatePath('/invoices');
  return { total: uniqueIds.length, succeeded, failed };
}

export async function bulkIssueInvoicesAction(ids: string[]): Promise<BulkActionResult> {
  return runBulkAction(ids, (id) => `/invoices/${id}/issue`, 'Faktura nije izdata.');
}

export async function bulkRemindInvoicesAction(ids: string[]): Promise<BulkActionResult> {
  return runBulkAction(ids, (id) => `/invoices/${id}/remind`, 'Podsjetnik nije poslan.');
}
