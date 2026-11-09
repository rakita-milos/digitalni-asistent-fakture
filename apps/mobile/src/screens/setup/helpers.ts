import type {
  CreateTaxRateInput,
  UpdateCompanyInput,
  UpdateReminderSettingsInput,
} from '@digitalni-asistent/shared';

/**
 * M-02 Setup wizard — čista logika (validacija i mapiranje forme na API ulaze).
 * Namjerno odvojeno od ekrana da bi se testiralo bez React Native okruženja.
 */

/** Ključevi u lokalnoj SQLite `meta` tabeli — prekid i nastavak setup-a (§8, M-02). */
export const SETUP_PROGRESS_KEY = 'setup_progress';
export const SETUP_COMPLETED_KEY = 'setup_completed';

export const SETUP_STEP_COUNT = 5;
export const SETUP_LAST_STEP = SETUP_STEP_COUNT - 1;

export const SETUP_STEP_TITLES = ['Firma', 'EFD', 'Porezi', 'Numeracija', 'Podsjetnici'] as const;

export const SETUP_STEP_HINTS = [
  'Osnovni podaci firme. JIB se ne mijenja kroz setup.',
  'Evidencija EFD ID-a — ESIR je u mock režimu dok operater ne odgovori (G0).',
  'Dodajte porezne stope koje koristite u fakturama.',
  'Prefiks, godina i sljedeći broj fakture (npr. FV2026-0001).',
  'Plan automatskih SMS podsjetnika i šablon poruke.',
] as const;

export const MAX_EFD_ID_LENGTH = 100;
export const MAX_NUMBERING_PREFIX_LENGTH = 20;
export const MIN_NUMBERING_YEAR = 2020;
export const MAX_NUMBERING_YEAR = 2100;
export const MIN_DUE_DAYS = 0;
export const MAX_DUE_DAYS = 365;
export const MIN_TAX_PERCENT = 0;
export const MAX_TAX_PERCENT = 100;
export const MAX_REMINDER_ITEMS = 4;
export const MIN_REMINDER_OFFSET_DAYS = -30;
export const MAX_REMINDER_OFFSET_DAYS = 30;
export const MIN_TEMPLATE_LENGTH = 10;
export const MAX_TEMPLATE_LENGTH = 500;

/** Telefon u BiH formatu, npr. +38766123456. */
const PHONE_PATTERN = /^\+387\d{8}$/;
/** Osnovni oblik e-maila (server dodatno validira istom Zod šemom). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SetupBuildResult<T> = { ok: true; input: T } | { ok: false; error: string };

export interface CompanyBasicsInput {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

export interface TaxRateFormInput {
  name: string;
  percent: string;
  sufCode: string;
}

export interface NumberingFormInput {
  numberingPrefix: string;
  numberingYear: string;
  numberingNext: string;
  defaultDueDays: string;
}

export interface ReminderFormInput {
  enabled: boolean;
  templateText: string;
  offsets: string[];
}

/** Sve vrijednosti forme potrebne za graduiranje ulaza pojedinog koraka. */
export interface SetupStepFormValues {
  company: CompanyBasicsInput;
  efdId: string;
  numbering: NumberingFormInput;
}

export function setupStepLabel(step: number): string {
  return `Korak ${step + 1}/${SETUP_STEP_COUNT}`;
}

export function setupStepTitle(step: number): string {
  return SETUP_STEP_TITLES[step] ?? `Korak ${step + 1}`;
}

export function setupStepHint(step: number): string {
  return SETUP_STEP_HINTS[step] ?? '';
}

/** Ograničava indeks koraka na 0–4 (i odbija NaN). */
export function clampSetupStep(step: number): number {
  if (!Number.isFinite(step)) {
    return 0;
  }
  return Math.min(SETUP_LAST_STEP, Math.max(0, Math.trunc(step)));
}

/** `setup_progress` iz SQLite (string) → indeks koraka; neispravno stanje vraća prvi korak. */
export function parseSetupProgress(raw: string | null): number {
  if (raw === null) {
    return 0;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 0;
  }
  return clampSetupStep(Number(trimmed));
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Cijeli broj iz unosa (bez razmaka, dozvoljen vodeći minus) unutar [min, max]. */
export function parseIntegerInRange(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

/**
 * Procenat iz unosa („17“, „17,5“ ili „17.5“) → bazni poeni (1700 / 1750).
 * Dozvoljena su najviše dva decimalna mjesta i opseg 0–100 %.
 */
export function parseTaxPercentBp(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const percent = Number(normalized);
  if (!Number.isFinite(percent) || percent < MIN_TAX_PERCENT || percent > MAX_TAX_PERCENT) {
    return null;
  }
  return Math.round(percent * 100);
}

/** Bazni poeni → tekst za prikaz, npr. 1700 → „17“, 1750 → „17,5“. */
export function formatRateBp(rateBp: number): string {
  const percent = rateBp / 100;
  if (Number.isInteger(percent)) {
    return String(percent);
  }
  return percent
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',');
}

/** Primjer broja fakture: `{prefix}{year}-{seq:4}` (npr. FV2026-0001). */
export function formatNumberPreview(prefix: string, year: number, next: number): string {
  return `${prefix}${year}-${String(next).padStart(4, '0')}`;
}

export function buildCompanyStepInput(
  values: CompanyBasicsInput,
): SetupBuildResult<UpdateCompanyInput> {
  const name = values.name.trim();
  const address = values.address.trim();
  const city = values.city.trim();
  const phone = values.phone.trim();
  const email = values.email.trim();

  if (name === '') {
    return { ok: false, error: 'Naziv firme je obavezan.' };
  }
  if (address === '') {
    return { ok: false, error: 'Adresa je obavezna.' };
  }
  if (city === '') {
    return { ok: false, error: 'Grad je obavezan.' };
  }
  if (phone === '') {
    return { ok: false, error: 'Telefon je obavezan.' };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, error: 'Telefon mora biti u formatu +387XXXXXXXX.' };
  }
  if (email === '') {
    return { ok: false, error: 'Email je obavezan.' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Email nije ispravan.' };
  }

  return { ok: true, input: { name, address, city, phone, email } };
}

/** EFD ID je opcioni; prazno polje briše vrijednost (`null`), kao i PATCH /company. */
export function buildEfdStepInput(efdId: string): SetupBuildResult<UpdateCompanyInput> {
  const trimmed = efdId.trim();
  if (trimmed.length > MAX_EFD_ID_LENGTH) {
    return {
      ok: false,
      error: `EFD ID može imati najviše ${MAX_EFD_ID_LENGTH} znakova.`,
    };
  }
  return { ok: true, input: { efdId: trimmed === '' ? null : trimmed } };
}

export function buildTaxRateInput(
  values: TaxRateFormInput,
): SetupBuildResult<CreateTaxRateInput> {
  const name = values.name.trim();
  const sufCode = values.sufCode.trim();
  const rateBp = parseTaxPercentBp(values.percent);

  if (name === '') {
    return { ok: false, error: 'Naziv stope je obavezan.' };
  }
  if (name.length > 50) {
    return { ok: false, error: 'Naziv stope može imati najviše 50 znakova.' };
  }
  if (rateBp === null) {
    return { ok: false, error: 'Procenat mora biti između 0 i 100 (npr. 17 ili 17,5).' };
  }
  if (sufCode === '') {
    return { ok: false, error: 'SUF kod je obavezan.' };
  }
  if (sufCode.length > 20) {
    return { ok: false, error: 'SUF kod može imati najviše 20 znakova.' };
  }

  return { ok: true, input: { name, rateBp, sufCode, active: true } };
}

export function buildNumberingStepInput(
  values: NumberingFormInput,
): SetupBuildResult<UpdateCompanyInput> {
  const numberingPrefix = values.numberingPrefix.trim();
  if (numberingPrefix.length > MAX_NUMBERING_PREFIX_LENGTH) {
    return {
      ok: false,
      error: `Prefiks može imati najviše ${MAX_NUMBERING_PREFIX_LENGTH} znakova.`,
    };
  }

  const numberingYear = parseIntegerInRange(
    values.numberingYear,
    MIN_NUMBERING_YEAR,
    MAX_NUMBERING_YEAR,
  );
  if (numberingYear === null) {
    return {
      ok: false,
      error: `Godina numeracije mora biti cijeli broj između ${MIN_NUMBERING_YEAR} i ${MAX_NUMBERING_YEAR}.`,
    };
  }

  const numberingNext = parseIntegerInRange(values.numberingNext, 1, Number.MAX_SAFE_INTEGER);
  if (numberingNext === null) {
    return { ok: false, error: 'Sljedeći broj fakture mora biti najmanje 1.' };
  }

  const defaultDueDays = parseIntegerInRange(values.defaultDueDays, MIN_DUE_DAYS, MAX_DUE_DAYS);
  if (defaultDueDays === null) {
    return {
      ok: false,
      error: `Rok plaćanja mora biti cijeli broj između ${MIN_DUE_DAYS} i ${MAX_DUE_DAYS} dana.`,
    };
  }

  return {
    ok: true,
    input: { numberingPrefix, numberingYear, numberingNext, defaultDueDays },
  };
}

export function buildReminderSettingsInput(
  values: ReminderFormInput,
): SetupBuildResult<UpdateReminderSettingsInput> {
  const text = values.templateText.trim();

  if (text.length < MIN_TEMPLATE_LENGTH) {
    return {
      ok: false,
      error: `Šablon mora imati najmanje ${MIN_TEMPLATE_LENGTH} znakova.`,
    };
  }
  if (text.length > MAX_TEMPLATE_LENGTH) {
    return {
      ok: false,
      error: `Šablon može imati najviše ${MAX_TEMPLATE_LENGTH} znakova.`,
    };
  }
  if (!text.includes('{broj}')) {
    return { ok: false, error: 'Šablon mora sadržavati {broj}.' };
  }
  if (!text.includes('{iznos}')) {
    return { ok: false, error: 'Šablon mora sadržavati {iznos}.' };
  }

  if (values.offsets.length > MAX_REMINDER_ITEMS) {
    return { ok: false, error: `Najviše ${MAX_REMINDER_ITEMS} automatska podsjetnika.` };
  }

  const schedule: UpdateReminderSettingsInput['schedule'] = [];

  for (const [index, rawOffset] of values.offsets.entries()) {
    const offsetDays = parseIntegerInRange(
      rawOffset,
      MIN_REMINDER_OFFSET_DAYS,
      MAX_REMINDER_OFFSET_DAYS,
    );
    if (offsetDays === null) {
      return {
        ok: false,
        error: `Podsjetnik ${index + 1}: pomak mora biti cijeli broj između ${MIN_REMINDER_OFFSET_DAYS} i ${MAX_REMINDER_OFFSET_DAYS} dana.`,
      };
    }
    schedule.push({ offsetDays, kind: 'sms' });
  }

  return {
    ok: true,
    input: { enabled: values.enabled, schedule, template: { text } },
  };
}

/**
 * Ulaz za PATCH /company za korake 1, 2 i 4 (indeksi 0, 1 i 3).
 * Korak „Porezi“ nema grupno čuvanje (stopa se dodaje odmah), zato `null`.
 */
export function buildSetupStepInput(
  step: number,
  values: SetupStepFormValues,
): SetupBuildResult<UpdateCompanyInput> | null {
  switch (step) {
    case 0:
      return buildCompanyStepInput(values.company);
    case 1:
      return buildEfdStepInput(values.efdId);
    case 3:
      return buildNumberingStepInput(values.numbering);
    default:
      return null;
  }
}
