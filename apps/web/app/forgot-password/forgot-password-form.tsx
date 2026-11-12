'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { forgotPasswordAction, type ForgotPasswordState } from '../actions';

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-[var(--radius-button)] bg-green-50 p-3 text-sm text-green-800">
          Ako nalog sa tom e-mail adresom postoji, poslali smo link za reset lozinke. Provjerite
          inbox (i spam) — link važi 30 minuta i može se iskoristiti samo jednom.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-[var(--radius-button)] bg-[color:var(--color-primary)] py-3 text-center font-semibold text-white"
        >
          Nazad na prijavu
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-gray-500">
          E-mail adresa naloga
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
          placeholder="vlasnik@firma.ba"
          required
        />
      </div>

      {state.error ? <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[var(--radius-button)] bg-[color:var(--color-primary)] py-3 font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'Šaljem…' : 'Pošalji link za reset'}
      </button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-[color:var(--color-primary)] hover:underline">
          Nazad na prijavu
        </Link>
      </p>
    </form>
  );
}
