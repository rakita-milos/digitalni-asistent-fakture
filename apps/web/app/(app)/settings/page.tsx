import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';

import { CompanyForm } from './company-form';
import { NumberingForm } from './numbering-form';
import { RemindersForm } from './reminders-form';
import { TaxRateForm } from './tax-rate-form';
import type { CompanySettings, ReminderSettings, TaxRateList } from './types';

const sectionClass = 'rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5';
const sectionTitleClass = 'text-lg font-semibold';
const sectionHintClass = 'mb-4 text-sm text-foreground/50';

/** Podešavanja — sve sekcije (§8): firma, numeracija, porezi i podsjetnici. */
export default async function SettingsPage() {
  let company: CompanySettings;
  let taxRates: TaxRateList;
  let reminders: ReminderSettings | null = null;

  try {
    [company, taxRates] = await Promise.all([
      apiFetch<CompanySettings>('/company'),
      apiFetch<TaxRateList>('/tax-rates'),
    ]);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      redirect('/login');
    }

    throw error;
  }

  // GET /reminder-settings je owner-only (§6) — zaposleni ne smiju pasti na cijeloj stranici.
  try {
    reminders = await apiFetch<ReminderSettings>('/reminder-settings');
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        redirect('/login');
      }
      if (error.status !== 403) {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Podešavanja</h1>
        <p className="text-sm text-foreground/60">
          Podaci firme, numeracija faktura, porezne stope i automatski podsjetnici.
        </p>
      </div>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Podaci o firmi</h2>
        <p className={sectionHintClass}>
          JIB: {company.jib} <span className="text-foreground/40">(se ne mijenja)</span>
        </p>
        <CompanyForm company={company} />
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Numeracija faktura</h2>
        <p className={sectionHintClass}>
          Godišnja sekvenca brojeva i podrazumijevani rok plaćanja novih faktura.
        </p>
        <NumberingForm
          numberingPrefix={company.numberingPrefix}
          numberingYear={company.numberingYear}
          numberingNext={company.numberingNext}
          defaultDueDays={company.defaultDueDays}
        />
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Porezne stope</h2>
        <p className={sectionHintClass}>
          Stope koje se nude na stavkama faktura; aktivne stope su podrazumijevane.
        </p>
        <TaxRateForm items={taxRates.items} />
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Automatski podsjetnici</h2>
        <p className={sectionHintClass}>
          Plan slanja i tekst poruke podsjetnika (max 4 automatska podsjetnika).
        </p>
        {reminders ? (
          <RemindersForm settings={reminders} />
        ) : (
          <p className="text-sm text-foreground/60">
            Podešavanja podsjetnika može vidjeti i mijenjati samo vlasnik firme.
          </p>
        )}
      </section>
    </div>
  );
}
