'use client';

import { useActionState, useState } from 'react';
import type { FormEvent } from 'react';

import { updateReminderSettingsAction } from './actions';
import type { ReminderSettings, SettingsFormState } from './types';

const initialState: SettingsFormState = {};

const MAX_REMINDER_ITEMS = 4;
const MIN_OFFSET_DAYS = -30;
const MAX_OFFSET_DAYS = 30;

const labelClass = 'mb-1 block text-sm text-gray-500';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';
const hintClass = 'mt-1 text-xs text-foreground/40';

interface RemindersFormProps {
  settings: ReminderSettings;
}

interface ScheduleDraft {
  offsetDays: string;
  kind: string;
}

/** Plan automatskih podsjetnika + šablon poruke — PUT /reminder-settings (§7.9). */
export function RemindersForm({ settings }: RemindersFormProps) {
  const [state, formAction, isPending] = useActionState(updateReminderSettingsAction, initialState);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [templateText, setTemplateText] = useState(settings.template.text);
  const [schedule, setSchedule] = useState<ScheduleDraft[]>(() =>
    settings.schedule.map((item) => ({
      offsetDays: String(item.offsetDays),
      kind: item.kind,
    })),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function addItem(): void {
    setSchedule((current) =>
      current.length >= MAX_REMINDER_ITEMS
        ? current
        : [...current, { offsetDays: '0', kind: 'sms' }],
    );
  }

  function removeItem(index: number): void {
    setSchedule((current) => current.filter((_, position) => position !== index));
  }

  function updateItem(index: number, patch: Partial<ScheduleDraft>): void {
    setSchedule((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }

  function validate(): string | null {
    if (templateText.trim().length < 10) {
      return 'Šablon mora imati najmanje 10 znakova.';
    }
    if (!templateText.includes('{broj}')) {
      return 'Šablon mora sadržavati {broj}.';
    }
    if (!templateText.includes('{iznos}')) {
      return 'Šablon mora sadržavati {iznos}.';
    }

    for (const item of schedule) {
      const rawOffset = item.offsetDays.trim();
      const offsetDays = rawOffset === '' ? Number.NaN : Number(rawOffset);

      if (!Number.isInteger(offsetDays) || offsetDays < MIN_OFFSET_DAYS || offsetDays > MAX_OFFSET_DAYS) {
        return 'Pomak dana mora biti cijeli broj između -30 i 30.';
      }
      if (!item.kind.trim()) {
        return 'Vrsta podsjetnika je obavezna.';
      }
    }

    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const error = validate();
    setLocalError(error);

    if (error) {
      event.preventDefault();
    }
  }

  const errorMessage = localError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span>Automatski podsjetnici su uključeni</span>
      </label>

      <div>
        <label htmlFor="reminder-template" className={labelClass}>
          Tekst šablona <span className="text-danger">*</span>
        </label>
        <textarea
          id="reminder-template"
          name="templateText"
          rows={5}
          required
          minLength={10}
          maxLength={500}
          value={templateText}
          onChange={(event) => setTemplateText(event.target.value)}
          className={inputClass}
        />
        <p className={hintClass}>
          Placeholderi: {'{broj}'}, {'{iznos}'}, {'{rok}'}, {'{firma}'}. Šablon obavezno
          sadrži {'{broj}'} i {'{iznos}'}.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Plan podsjetnika</h3>
          <span className="text-xs text-foreground/40">
            {schedule.length}/{MAX_REMINDER_ITEMS}
          </span>
        </div>

        <div className="space-y-2">
          {schedule.length === 0 ? (
            <p className="rounded-[var(--radius-button)] bg-black/[0.02] p-3 text-sm text-foreground/50">
              Plan je prazan — automatski podsjetnici se neće zakazivati.
            </p>
          ) : null}

          {schedule.map((item, index) => (
            <div
              key={index}
              className="grid items-end gap-2 rounded-[var(--radius-button)] border border-gray-200 p-3 sm:grid-cols-12"
            >
              <label className="block text-sm sm:col-span-4">
                <span className="mb-1 block text-xs text-foreground/50">
                  Pomak dana (stavka {index + 1})
                </span>
                <input
                  name="offsetDays"
                  type="text"
                  inputMode="numeric"
                  value={item.offsetDays}
                  onChange={(event) => updateItem(index, { offsetDays: event.target.value })}
                  className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="npr. -3"
                />
              </label>

              <label className="block text-sm sm:col-span-4">
                <span className="mb-1 block text-xs text-foreground/50">Vrsta</span>
                <input
                  name="kind"
                  type="text"
                  maxLength={30}
                  value={item.kind}
                  onChange={(event) => updateItem(index, { kind: event.target.value })}
                  className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="sms"
                />
              </label>

              <div className="flex justify-end sm:col-span-4">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-[var(--radius-button)] border border-danger px-3 py-1.5 text-xs font-semibold text-danger"
                  aria-label={`Ukloni stavku ${index + 1}`}
                >
                  Ukloni
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={addItem}
            disabled={schedule.length >= MAX_REMINDER_ITEMS}
            className="rounded-[var(--radius-button)] border border-primary px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
          >
            Dodaj stavku
          </button>
        </div>
        <p className={hintClass}>
          Negativan pomak = prije roka, pozitivan = poslije roka (dani). Najviše 4 stavke.
        </p>
      </div>

      {errorMessage ? <p className="text-sm text-[color:var(--color-danger)]">{errorMessage}</p> : null}
      {state.success ? (
        <p className="text-sm text-[color:var(--color-success)]">{state.success}</p>
      ) : null}

      <div className="border-t border-black/5 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-button)] bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Čuvanje…' : 'Sačuvaj podešavanja'}
        </button>
      </div>
    </form>
  );
}
