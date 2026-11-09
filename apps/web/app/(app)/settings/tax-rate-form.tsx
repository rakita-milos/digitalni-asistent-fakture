'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { createTaxRateAction } from './actions';
import type { SettingsFormState, TaxRate } from './types';

const initialState: SettingsFormState = {};

const labelClass = 'mb-1 block text-sm text-gray-500';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';
const hintClass = 'mt-1 text-xs text-foreground/40';

interface TaxRateFormProps {
  items: TaxRate[];
}

interface TaxRateFormValues {
  name: string;
  ratePercent: string;
  sufCode: string;
  active: boolean;
}

const emptyValues: TaxRateFormValues = { name: '', ratePercent: '', sufCode: '', active: true };

/** Bazni poeni → procenat za prikaz (1700 bp = „17%“). */
function formatRateBp(rateBp: number): string {
  return `${rateBp / 100}%`;
}

/** Lista poreznih stopa + forma za dodavanje — GET/POST /tax-rates (§8). */
export function TaxRateForm({ items }: TaxRateFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createTaxRateAction, initialState);
  const [values, setValues] = useState<TaxRateFormValues>(emptyValues);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    // Uspjeh: osvježi listu koju renderuje server komponenta (novi red iz API-ja).
    router.refresh();
  }, [state, router]);

  function setField<K extends keyof TaxRateFormValues>(
    field: K,
    value: TaxRateFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-[var(--radius-button)] border border-black/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-foreground/60">
            <tr>
              <th className="px-4 py-3">Naziv</th>
              <th className="px-4 py-3">Stopa</th>
              <th className="px-4 py-3">SUF kod</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-foreground/50">
                  Još nema poreznih stopa.
                </td>
              </tr>
            ) : (
              items.map((rate) => (
                <tr key={rate.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{rate.name}</td>
                  <td className="px-4 py-3">{formatRateBp(rate.rateBp)}</td>
                  <td className="px-4 py-3 text-foreground/60">{rate.sufCode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        rate.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rate.active ? 'Aktivna' : 'Neaktivna'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tax-rate-name" className={labelClass}>
              Naziv stope <span className="text-danger">*</span>
            </label>
            <input
              id="tax-rate-name"
              name="name"
              type="text"
              required
              maxLength={50}
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              className={inputClass}
              placeholder="npr. PDV 17%"
            />
          </div>

          <div>
            <label htmlFor="tax-rate-percent" className={labelClass}>
              Procenat (%) <span className="text-danger">*</span>
            </label>
            <input
              id="tax-rate-percent"
              name="ratePercent"
              type="text"
              inputMode="decimal"
              required
              value={values.ratePercent}
              onChange={(event) => setField('ratePercent', event.target.value)}
              className={inputClass}
              placeholder="17"
            />
            <p className={hintClass}>Decimalno, npr. 17 ili 17,5 (0–100).</p>
          </div>

          <div>
            <label htmlFor="tax-rate-suf" className={labelClass}>
              SUF kod <span className="text-danger">*</span>
            </label>
            <input
              id="tax-rate-suf"
              name="sufCode"
              type="text"
              required
              maxLength={20}
              value={values.sufCode}
              onChange={(event) => setField('sufCode', event.target.value)}
              className={inputClass}
              placeholder="npr. PDV17"
            />
            <p className={hintClass}>Kod za fiskalni račun (suf_code).</p>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                checked={values.active}
                onChange={(event) => setField('active', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>Aktivna stopa</span>
            </label>
          </div>
        </div>

        {state.error ? (
          <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-[color:var(--color-success)]">{state.success}</p>
        ) : null}

        <div className="border-t border-black/5 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending ? 'Dodavanje…' : 'Dodaj stopu'}
          </button>
        </div>
      </form>
    </div>
  );
}
