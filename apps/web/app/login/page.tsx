import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Digitalni Asistent</p>
        <h1 className="mt-2 text-2xl font-semibold">Prijava</h1>
        <p className="mt-1 mb-6 text-sm text-foreground/60">Fakturisanje i naplata za mikro-poduzeća.</p>
        <LoginForm />
      </section>
    </main>
  );
}
