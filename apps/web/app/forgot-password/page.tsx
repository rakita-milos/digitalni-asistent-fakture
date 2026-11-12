import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Digitalni Asistent</p>
        <h1 className="mt-2 text-2xl font-semibold">Zaboravljena lozinka</h1>
        <p className="mt-1 mb-6 text-sm text-foreground/60">
          Unesite e-mail adresu naloga — poslaćemo link za postavljanje nove lozinke.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
