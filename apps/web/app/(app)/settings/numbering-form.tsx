'use client';

import { useActionState, useState } from 'react';

import { updateNumberingAction } from './actions';
import type { SettingsFormState } from './types';

const initialState: SettingsFormState = {};

const labelClass = 'mb-1 block text-sm text-gray-500';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';
const hintClass = 'mt-1 text-xs text-foreground/40';

interface NumberingFormProps {
  numberingPrefix: string;
  numberingYear: number;
  numberingNext: number;
  defaultDueDays: number;
}

interface NumberingFormValues {
  numberingPrefix: string;
  numberingYear: string;
  numberingNext: string;
  defaultDueDays: string;
}

/** Numeracija faktura i podrazumijevani rok — PATCH /company (§7.1, §8). */
export function NumberingForm({
  numberingPrefix,
  numberingYear,
  numberingNext,
  defaultDueDays,
}: NumberingFormProps) {
  const [state, formAction, isPending] = useActionState(updateNumberingAction, initialState);
  const [values, setValues] = useState<NumberingFormValues>({
    numberingPrefix,
    numberingYear: String(numberingYear),
    numberingNext: String(numberingNext),
    defaultDueDays: String(defaultDueDays),
  });

  function setField(field: keyof NumberingFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="numbering-prefix" className={labelClass}>
            Prefiks numeracije
          </label>
          <input
            id="numbering-prefix"
            name="numberingPrefix"
            type="text"
            maxLength={20}
            value={values.numberingPrefix}
            onChange={(event) => setField('numberingPrefix', event.target.value)}
            className={inputClass}
            placeholder="npr. FA (može ostati prazno)"
          />
          <p className={hintClass}>Prefiks se dodaje ispred broja, npr. FA2026-0001.</p>
        </div>

        <div>
          <label htmlFor="numbering-year" className={labelClass}>
            Godina numeracije <span className="text-danger">*</span>
          </label>
          <input
            id="numbering-year"
            name="numberingYear"
            type="number"
            required
            min={2020}
            max={2100}
            step={1}
            value={values.numberingYear}
            onChange={(event) => setField('numberingYear', event.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>Između 2020 i 2100.</p>
        </div>

        <div>
          <label htmlFor="numbering-next" className={labelClass}>
            Sljedeći broj <span className="text-danger">*</span>
          </label>
          <input
            id="numbering-next"
            name="numberingNext"
            type="number"
            required
            min={1}
            step={1}
            value={values.numberingNext}
            onChange={(event) => setField('numberingNext', event.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>Sljedeći izdati broj u tekućoj godini.</p>
        </div>

        <div>
          <label htmlFor="numbering-due-days" className={labelClass}>
            Rok plaćanja (dana) <span className="text-danger">*</span>
          </label>
          <input
            id="numbering-due-days"
            name="defaultDueDays"
            type="number"
            required
            min={0}
            max={365}
            step={1}
            value={values.defaultDueDays}
            onChange={(event) => setField('defaultDueDays', event.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>Podrazumijevani rok dospijeća novih faktura (0–365).</p>
        </div>
      </div>

      {state.error ? <p className="text-sm text-[color:var(--color-danger)]">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-[color:var(--color-success)]">{state.success}</p>
      ) : null}

      <div className="border-t border-black/5 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Čuvanje…' : 'Sačuvaj numeraciju'}
        </button>
      </div>
    </form>
  );
}
