import Link from 'next/link';
import type { ReactNode } from 'react';

/** Zajednički okvir javnih pravnih stranica: brend, navigacija i podnožje. */
export default function LegalLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 p-4">
          <Link href="/login" className="font-semibold text-primary">
            Digitalni Asistent
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-foreground/70 hover:text-primary">
              Privatnost
            </Link>
            <Link href="/terms" className="text-foreground/70 hover:text-primary">
              Uslovi
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">{children}</main>

      <footer className="mx-auto max-w-3xl px-6 pb-8 text-center text-xs text-foreground/50">
        <p>
          Digitalni Asistent · <Link href="/privacy" className="underline">Politika privatnosti</Link> ·{' '}
          <Link href="/terms" className="underline">Uslovi korištenja</Link>
        </p>
      </footer>
    </div>
  );
}
