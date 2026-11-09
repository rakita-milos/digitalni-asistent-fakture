'use client';

import { useActionState, useState } from 'react';

import { updateCompanyAction } from './actions';
import type { CompanySettings, SettingsFormState } from './types';

const initialState: SettingsFormState = {};

const labelClass = 'mb-1 block text-sm text-gray-500';
const inputClass =
  'w-full rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-primary)]';
const hintClass = 'mt-1 text-xs text-foreground/40';

interface CompanyFormProps {
  company: CompanySettings;
}

interface CompanyFormValues {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string;
  efdId: string;
}

/** Forma profila firme — PATCH /company (§8: Podešavanja). */
export function CompanyForm({ company }: CompanyFormProps) {
  const [state, formAction, isPending] = useActionState(updateCompanyAction, initialState);
  const [values, setValues] = useState<CompanyFormValues>({
    name: company.name,
    address: company.address,
    city: company.city,
    phone: company.phone,
    email: company.email,
    logoUrl: company.logoUrl ?? '',
    efdId: company.efdId ?? '',
  });

  function setField(field: keyof CompanyFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="company-name" className={labelClass}>
            Naziv firme <span className="text-danger">*</span>
          </label>
          <input
            id="company-name"
            name="name"
            type="text"
            required
            maxLength={200}
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
            placeholder="Naziv firme"
          />
        </div>

        <div>
          <label htmlFor="company-address" className={labelClass}>
            Adresa <span className="text-danger">*</span>
          </label>
          <input
            id="company-address"
            name="address"
            type="text"
            required
            maxLength={200}
            value={values.address}
            onChange={(event) => setField('address', event.target.value)}
            className={inputClass}
            placeholder="Ulica i broj"
          />
        </div>

        <div>
          <label htmlFor="company-city" className={labelClass}>
            Grad <span className="text-danger">*</span>
          </label>
          <input
            id="company-city"
            name="city"
            type="text"
            required
            maxLength={100}
            value={values.city}
            onChange={(event) => setField('city', event.target.value)}
            className={inputClass}
            placeholder="npr. Banja Luka"
          />
        </div>

        <div>
          <label htmlFor="company-phone" className={labelClass}>
            Telefon <span className="text-danger">*</span>
          </label>
          <input
            id="company-phone"
            name="phone"
            type="tel"
            required
            value={values.phone}
            onChange={(event) => setField('phone', event.target.value)}
            className={inputClass}
            placeholder="+38766123456"
          />
          <p className={hintClass}>Format: +387XXXXXXXX.</p>
        </div>

        <div>
          <label htmlFor="company-email" className={labelClass}>
            E-mail <span className="text-danger">*</span>
          </label>
          <input
            id="company-email"
            name="email"
            type="email"
            required
            maxLength={254}
            value={values.email}
            onChange={(event) => setField('email', event.target.value)}
            className={inputClass}
            placeholder="firma@primjer.ba"
          />
        </div>

        <div>
          <label htmlFor="company-logo" className={labelClass}>
            Logo URL
          </label>
          <input
            id="company-logo"
            name="logoUrl"
            type="text"
            maxLength={2048}
            value={values.logoUrl}
            onChange={(event) => setField('logoUrl', event.target.value)}
            className={inputClass}
            placeholder="https://…/logo.png"
          />
          <p className={hintClass}>Ostavite prazno da uklonite logo.</p>
        </div>

        <div>
          <label htmlFor="company-efd" className={labelClass}>
            EFD ID
          </label>
          <input
            id="company-efd"
            name="efdId"
            type="text"
            maxLength={100}
            value={values.efdId}
            onChange={(event) => setField('efdId', event.target.value)}
            className={inputClass}
            placeholder="EFD identifikator (opciono)"
          />
          <p className={hintClass}>Ostavite prazno da uklonite EFD ID.</p>
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
          {isPending ? 'Čuvanje…' : 'Sačuvaj podatke firme'}
        </button>
      </div>
    </form>
  );
}
