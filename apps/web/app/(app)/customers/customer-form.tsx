'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { Customer, CustomerFormState } from './types';

const initialState: CustomerFormState = {};

const labelClass = 'mb-1 block text-sm text-gray-500';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';

interface CustomerFormProps {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  customer?: Customer;
}

/** Forma kupca — koristi se i za novog kupca i za izmjenu (§8: Kupci). */
export function CustomerForm({
  action,
  submitLabel,
  pendingLabel,
  cancelHref,
  customer,
}: CustomerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Naziv <span className="text-danger">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            defaultValue={customer?.name ?? ''}
            className={inputClass}
            placeholder="Naziv kupca ili firme"
          />
        </div>

        <div>
          <label htmlFor="jib" className={labelClass}>
            JIB
          </label>
          <input
            id="jib"
            name="jib"
            type="text"
            inputMode="numeric"
            maxLength={13}
            defaultValue={customer?.jib ?? ''}
            className={inputClass}
            placeholder="13 cifara"
          />
          <p className="mt-1 text-xs text-foreground/40">Tačno 13 cifara.</p>
        </div>

        <div>
          <label htmlFor="vatId" className={labelClass}>
            PIB / PDV broj
          </label>
          <input
            id="vatId"
            name="vatId"
            type="text"
            maxLength={20}
            defaultValue={customer?.vatId ?? ''}
            className={inputClass}
            placeholder="npr. 20001234567"
          />
        </div>

        <div>
          <label htmlFor="address" className={labelClass}>
            Adresa
          </label>
          <input
            id="address"
            name="address"
            type="text"
            maxLength={200}
            defaultValue={customer?.address ?? ''}
            className={inputClass}
            placeholder="Ulica i broj"
          />
        </div>

        <div>
          <label htmlFor="city" className={labelClass}>
            Grad
          </label>
          <input
            id="city"
            name="city"
            type="text"
            maxLength={100}
            defaultValue={customer?.city ?? ''}
            className={inputClass}
            placeholder="npr. Banja Luka"
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={customer?.phone ?? ''}
            className={inputClass}
            placeholder="+38766123456"
          />
          <p className="mt-1 text-xs text-foreground/40">Format: +387XXXXXXXX.</p>
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ''}
            className={inputClass}
            placeholder="kupac@firma.ba"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="note" className={labelClass}>
            Napomena
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={customer?.note ?? ''}
            className={inputClass}
            placeholder="Interna napomena o kupcu (opciono)"
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-foreground/60 hover:text-primary">
          Otkaži
        </Link>
      </div>
    </form>
  );
}
