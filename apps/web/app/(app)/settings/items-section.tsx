'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';

import { createItemAction, itemRowAction } from './actions';
import type { Item, SettingsFormState, TaxRate } from './types';

const initialState: SettingsFormState = {};

const labelClass = 'mb-1 block text-xs text-foreground/50';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';

/** Fening → KM za prikaz u inputu („2550“ → „25,50“). */
function priceInput(priceFening: number): string {
  return (priceFening / 100).toFixed(2).replace('.', ',');
}

interface ItemsSectionProps {
  items: Item[];
  taxRates: TaxRate[];
}

/**
 * Katalog artikala (S11): lista sa izmjenom cijene/naziva i arhiviranjem.
 * §6 nema PATCH /items — ruta je dodata uz `PATCH /customers/:id` (vidi PROGRESS, odluka 24).
 */
export function ItemsSection({ items, taxRates }: ItemsSectionProps) {
  const router = useRouter();
  const [createState, createAction, isCreating] = useActionState(createItemAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!createState.success) {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [createState, router]);

  // Opcije poreza: aktivne stope, bez duplikata po baznim poenima.
  const rateOptions = Array.from(
    new Map(taxRates.map((rate) => [rate.rateBp, rate])).values(),
  ).sort((first, second) => first.rateBp - second.rateBp);

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <p className="rounded-[var(--radius-button)] border border-black/5 px-4 py-6 text-center text-sm text-foreground/50">
          Katalog je prazan — dodajte prvi artikal ispod.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} rateOptions={rateOptions} />
          ))}
        </div>
      )}

      <form ref={formRef} action={createAction} className="space-y-4 border-t border-black/5 pt-4">
        <p className="text-sm font-semibold">Novi artikal</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="item-new-name" className={labelClass}>
              Naziv <span className="text-danger">*</span>
            </label>
            <input
              id="item-new-name"
              name="name"
              type="text"
              required
              maxLength={200}
              className={inputClass}
              placeholder="npr. Zamjena ulja"
            />
          </div>

          <div>
            <label htmlFor="item-new-unit" className={labelClass}>
              Jedinica <span className="text-danger">*</span>
            </label>
            <input
              id="item-new-unit"
              name="unit"
              type="text"
              required
              maxLength={20}
              defaultValue="kom"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="item-new-price" className={labelClass}>
              Cijena (KM) <span className="text-danger">*</span>
            </label>
            <input
              id="item-new-price"
              name="price"
              type="text"
              inputMode="decimal"
              required
              className={inputClass}
              placeholder="25,00"
            />
          </div>

          <div>
            <label htmlFor="item-new-tax" className={labelClass}>
              Porezna stopa <span className="text-danger">*</span>
            </label>
            <select id="item-new-tax" name="taxRateBp" required className={inputClass}>
              {rateOptions.length === 0 ? <option value="">Nema stopa</option> : null}
              {rateOptions.map((rate) => (
                <option key={rate.id} value={rate.rateBp}>
                  {rate.name} ({rate.rateBp / 100}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {createState.error ? (
          <p className="text-sm text-[color:var(--color-danger)]">{createState.error}</p>
        ) : null}
        {createState.success ? (
          <p className="text-sm text-[color:var(--color-success)]">{createState.success}</p>
        ) : null}

        <button
          type="submit"
          disabled={isCreating || rateOptions.length === 0}
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isCreating ? 'Dodavanje…' : 'Dodaj artikal'}
        </button>
        {rateOptions.length === 0 ? (
          <p className="text-xs text-foreground/40">
            Prvo dodajte poreznu stopu — artikal mora imati stopu PDV-a.
          </p>
        ) : null}
      </form>
    </div>
  );
}

interface ItemCardProps {
  item: Item;
  rateOptions: TaxRate[];
}

/** Jedan artikal: izmjena u mjestu + arhiviranje (jedna forma, dva submit dugmeta). */
function ItemCard({ item, rateOptions }: ItemCardProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(itemRowAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state, router]);

  // Stopa artikla može biti van aktivnih stopa (stariji zapis) — prikaži je da se ne izgubi.
  const hasRate = rateOptions.some((rate) => rate.rateBp === item.taxRateBp);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-[var(--radius-button)] border border-black/5 p-4"
    >
      <input type="hidden" name="itemId" value={item.id} />

      <div>
        <label htmlFor={`item-name-${item.id}`} className={labelClass}>
          Naziv
        </label>
        <input
          id={`item-name-${item.id}`}
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={item.name}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor={`item-unit-${item.id}`} className={labelClass}>
            Jedinica
          </label>
          <input
            id={`item-unit-${item.id}`}
            name="unit"
            type="text"
            required
            maxLength={20}
            defaultValue={item.unit}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`item-price-${item.id}`} className={labelClass}>
            Cijena (KM)
          </label>
          <input
            id={`item-price-${item.id}`}
            name="price"
            type="text"
            inputMode="decimal"
            required
            defaultValue={priceInput(item.priceFening)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`item-tax-${item.id}`} className={labelClass}>
            PDV
          </label>
          <select
            id={`item-tax-${item.id}`}
            name="taxRateBp"
            defaultValue={String(item.taxRateBp)}
            className={inputClass}
          >
            {hasRate ? null : <option value={item.taxRateBp}>{item.taxRateBp / 100}%</option>}
            {rateOptions.map((rate) => (
              <option key={rate.id} value={rate.rateBp}>
                {rate.rateBp / 100}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[color:var(--color-success)]">{state.success}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={isPending}
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Čuvanje…' : 'Sačuvaj'}
        </button>
        <button
          type="submit"
          name="intent"
          value="archive"
          disabled={isPending}
          className="rounded-[var(--radius-button)] border border-[color:var(--color-danger)] px-3 py-2 text-sm font-semibold text-[color:var(--color-danger)] disabled:opacity-60"
        >
          Arhiviraj
        </button>
      </div>
    </form>
  );
}
