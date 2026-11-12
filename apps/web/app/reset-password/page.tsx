import Link from 'next/link';

import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Digitalni Asistent</p>
        <h1 className="mt-2 text-2xl font-semibold">Nova lozinka</h1>

        {token ? (
          <>
            <p className="mt-1 mb-6 text-sm text-foreground/60">
              Postavite novu lozinku za svoj nalog. Link se može iskoristiti samo jednom.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <p className="mt-1 mb-6 text-sm text-foreground/60">
              Link nije valjan ili je istekao. Zatražite novi link za reset lozinke.
            </p>
            <Link
              href="/forgot-password"
              className="block w-full rounded-[var(--radius-button)] bg-[color:var(--color-primary)] py-3 text-center font-semibold text-white"
            >
              Zatraži novi link
            </Link>
            <p className="mt-4 text-center text-sm">
              <Link href="/login" className="text-[color:var(--color-primary)] hover:underline">
                Nazad na prijavu
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
