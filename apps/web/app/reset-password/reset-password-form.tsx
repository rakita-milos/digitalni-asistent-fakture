'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { resetPasswordAction, type ResetPasswordState } from '../actions';

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-gray-500">
          Nova lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
          placeholder="Najmanje 8 znakova"
          required
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm text-gray-500">
          Ponovite novu lozinku
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
          placeholder="••••••••"
          required
        />
      </div>

      {state.error ? <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[var(--radius-button)] bg-[color:var(--color-primary)] py-3 font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'Čuvam…' : 'Postavi novu lozinku'}
      </button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-[color:var(--color-primary)] hover:underline">
          Nazad na prijavu
        </Link>
      </p>
    </form>
  );
}
