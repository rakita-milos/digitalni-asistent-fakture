'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';

import type { CustomerFormState } from './types';

/**
 * Server akcije za kupce (W-06).
 * Validaciju i perzistenciju radi API; web samo prosljeđuje unos i prikazuje greške.
 */

const OPTIONAL_FIELDS = ['jib', 'vatId', 'address', 'city', 'phone', 'email', 'note'] as const;

/** Trimuje unos; prazna opciona polja se ne šalju (PATCH tako ostaje djelimičan). */
function customerPayload(formData: FormData): { name: string; body: Record<string, unknown> } {
  const body: Record<string, unknown> = {};
  const name = String(formData.get('name') ?? '').trim();

  if (name) {
    body.name = name;
  }

  for (const field of OPTIONAL_FIELDS) {
    const value = String(formData.get(field) ?? '').trim();

    if (value) {
      body[field] = value;
    }
  }

  // §7.9: opt-out podsjetnika (checkbox; odsutan = false).
  body.reminderOptOut = formData.get('reminderOptOut') === 'on';

  return { name, body };
}

function toFormError(error: unknown): CustomerFormState {
  if (error instanceof ApiFailure) {
    if (error.status === 401) {
      redirect('/login');
    }

    return { error: error.message };
  }

  throw error;
}

export async function createCustomerAction(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { name, body } = customerPayload(formData);

  if (!name) {
    return { error: 'Naziv kupca je obavezan' };
  }

  try {
    await apiFetch('/customers', { method: 'POST', body: JSON.stringify(body) });
  } catch (error) {
    return toFormError(error);
  }

  revalidatePath('/customers');
  redirect('/customers');
}

export async function updateCustomerAction(
  id: string,
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { name, body } = customerPayload(formData);

  if (!name) {
    return { error: 'Naziv kupca je obavezan' };
  }

  try {
    await apiFetch(`/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (error) {
    return toFormError(error);
  }

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

/** Meko brisanje: PATCH `{ archivedAt }` (§6 nema DELETE rutu). */
export async function archiveCustomerAction(id: string): Promise<void> {
  try {
    await apiFetch(`/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
    });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }

    throw error;
  }

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  redirect('/customers');
}
