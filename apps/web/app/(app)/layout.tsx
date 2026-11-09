import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { logoutAction } from '../actions';
import { ACCESS_COOKIE } from '../../lib/session';

const NAV_ITEMS = [
  { href: '/', label: 'Početna' },
  { href: '/invoices', label: 'Fakture' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();

  if (!store.get(ACCESS_COOKIE)?.value) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-primary">Digitalni Asistent</span>
            <nav className="flex gap-4 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="text-foreground/70 hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-danger hover:underline">
              Odjavi se
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
