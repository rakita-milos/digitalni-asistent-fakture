import Link from 'next/link';

import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; deleted?: string }>;
}) {
  const { reset, deleted } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Digitalni Asistent</p>
        <h1 className="mt-2 text-2xl font-semibold">Prijava</h1>
        <p className="mt-1 mb-6 text-sm text-foreground/60">Fakturisanje i naplata za mikro-poduzeća.</p>

        {deleted ? (
          <p className="mb-4 rounded-[var(--radius-button)] bg-green-50 p-3 text-sm text-green-800">
            Nalog je obrisan. Lični podaci su uklonjeni, a fiskalni dokumenti su zadržani u skladu
            sa zakonom.
          </p>
        ) : null}

        {reset ? (
          <p className="mb-4 rounded-[var(--radius-button)] bg-green-50 p-3 text-sm text-green-800">
            Lozinka je promijenjena. Prijavite se novom lozinkom.
          </p>
        ) : null}

        <LoginForm />

        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="text-[color:var(--color-primary)] hover:underline">
            Zaboravili ste lozinku?
          </Link>
        </p>
      </section>
    </main>
  );
}
