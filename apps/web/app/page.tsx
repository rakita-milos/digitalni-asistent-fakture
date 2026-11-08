import { APP_NAME, CURRENCY, TIMEZONE } from '@digitalni-asistent/shared';

/**
 * Sprint 0 — samo dokaz da Next.js App Router + Tailwind 4 + @digitalni-asistent/shared rade.
 * Ekrani W-01…W-08 (MASTER PROMPT §8) dolaze u sprintovima 1–6.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-[var(--radius-card)] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">{APP_NAME}</p>
        <h1 className="mt-2 text-2xl font-semibold">Sprint 0 — kostur monorepo-a</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/70">
          Web (Next.js App Router) je podignut i dijeli tipove/šeme sa API-jem preko{' '}
          <code className="rounded bg-black/5 px-1 py-0.5">@digitalni-asistent/shared</code>.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-foreground/50">Valuta</dt>
            <dd className="font-medium">{CURRENCY}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Vremenska zona</dt>
            <dd className="font-medium">{TIMEZONE}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
