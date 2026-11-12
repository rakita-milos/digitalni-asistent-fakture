'use client';

import { useState, useTransition } from 'react';

import { deleteAccountAction } from './actions';

/** W-08: izvoz podataka i brisanje naloga (GDPR, §10/§21.12). */
export function AccountSection() {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    setError(null);

    startTransition(async () => {
      const result = await deleteAccountAction(confirmation);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm text-foreground/60">
          Preuzmite sve podatke firme u JSON formatu: fakture, kupce, naplate, podsjetnike, fiskalne
          zapise i audit trag. Izvoz ne sadrži lozinke ni tokene sesija.
        </p>
        <a
          href="/api/account/export"
          className="inline-block rounded-[var(--radius-button)] border border-primary px-3 py-2 text-sm font-semibold text-primary"
        >
          Preuzmi podatke (JSON)
        </a>
      </div>

      <div className="rounded-[var(--radius-button)] border border-danger/40 bg-red-50/60 p-4">
        <p className="text-sm font-semibold text-danger">Brisanje naloga</p>
        <p className="mt-1 mb-3 text-sm text-foreground/70">
          Brišu se lični podaci naloga i kontakt podaci kupaca. Fiskalni računi i fakture ostaju
          sačuvani zbog zakonske obaveze čuvanja. Ova radnja se ne može poništiti.
        </p>
        <label className="mb-1 block text-xs text-foreground/60" htmlFor="account-confirm">
          Upišite <span className="font-mono font-semibold">OBRISI</span> za potvrdu
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="account-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="w-40 rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="OBRISI"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending || confirmation !== 'OBRISI'}
            className="rounded-[var(--radius-button)] bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? 'Brišem…' : 'Obriši nalog'}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
