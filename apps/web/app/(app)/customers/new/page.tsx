import Link from 'next/link';

import { createCustomerAction } from '../actions';
import { CustomerForm } from '../customer-form';

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Novi kupac</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Podaci o kupcu koriste se na fakturama i opomenama.
          </p>
        </div>
        <Link href="/customers" className="text-sm text-foreground/60 hover:text-primary">
          ← Kupci
        </Link>
      </div>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <CustomerForm
          action={createCustomerAction}
          submitLabel="Sačuvaj kupca"
          pendingLabel="Čuvanje…"
          cancelHref="/customers"
        />
      </section>
    </div>
  );
}
