'use client';

import { useActionState } from 'react';

import { loginAction, type LoginState } from '../actions';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1 block text-sm text-gray-500">
          Email ili telefon
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          className="w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]"
          placeholder="vlasnik@firma.ba"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-gray-500">
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {isPending ? 'Prijava…' : 'Prijavi se'}
      </button>
    </form>
  );
}
