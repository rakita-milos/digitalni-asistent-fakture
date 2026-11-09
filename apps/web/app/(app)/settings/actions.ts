'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';

import type { ReminderScheduleItem, SettingsFormState } from './types';

/**
 * Server akcije za podešavanja (W-08): firma, numeracija, porezne stope i podsjetnici.
 *
 * Poslovna pravila i perzistenciju radi API — web provjerava osnovna ograničenja
 * (obavezna polja, opsezi) da korisnik odmah dobije jasnu poruku, a `message`
 * iz API greške prikazuje za sve ostalo (npr. „Samo vlasnik…“).
 */

/** Zajednička pravila iz `packages/shared` (schema.reminder). */
const MAX_REMINDER_ITEMS = 4;
const MIN_OFFSET_DAYS = -30;
const MAX_OFFSET_DAYS = 30;
/** Isti format kao `phoneSchema` (§7.11). */
const PHONE_PATTERN = /^\+387\d{8}$/;
/** Isti format kao `emailSchema` (§7.11) — dovoljno za jasnu poruku prije API-ja. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toFormState(error: unknown): SettingsFormState {
  if (error instanceof ApiFailure) {
    if (error.status === 401) {
      redirect('/login');
    }

    return { error: error.message };
  }

  throw error;
}

function textValue(formData: FormData, field: string): string {
  return String(formData.get(field) ?? '').trim();
}

/** Cijeli broj iz forme; `null` ako polje nije popunjeno ili nije cijeli broj. */
function integerValue(formData: FormData, field: string): number | null {
  const raw = textValue(formData, field);

  if (raw === '') {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Decimalni broj iz forme; prihvata i decimalni zarez (npr. „17,5“). */
function decimalValue(formData: FormData, field: string): number | null {
  const raw = textValue(formData, field).replace(',', '.');

  if (raw === '') {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** PATCH /company — podaci firme (owner). Prazni `logoUrl`/`efdId` se brišu (`null`). */
export async function updateCompanyAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const name = textValue(formData, 'name');
  const address = textValue(formData, 'address');
  const city = textValue(formData, 'city');
  const phone = textValue(formData, 'phone');
  const email = textValue(formData, 'email');
  const logoUrl = textValue(formData, 'logoUrl');
  const efdId = textValue(formData, 'efdId');

  if (!name || !address || !city || !phone || !email) {
    return { error: 'Naziv, adresa, grad, telefon i e-mail su obavezni.' };
  }
  if (name.length > 200) {
    return { error: 'Naziv firme može imati najviše 200 znakova.' };
  }
  if (address.length > 200) {
    return { error: 'Adresa može imati najviše 200 znakova.' };
  }
  if (city.length > 100) {
    return { error: 'Grad može imati najviše 100 znakova.' };
  }
  if (!PHONE_PATTERN.test(phone)) {
    return { error: 'Telefon mora biti u formatu +387XXXXXXXX.' };
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: 'E-mail nije ispravan.' };
  }
  if (logoUrl.length > 2048) {
    return { error: 'Logo URL može imati najviše 2048 znakova.' };
  }
  if (efdId.length > 100) {
    return { error: 'EFD ID može imati najviše 100 znakova.' };
  }

  const body = {
    name,
    address,
    city,
    phone,
    email,
    logoUrl: logoUrl === '' ? null : logoUrl,
    efdId: efdId === '' ? null : efdId,
  };

  try {
    await apiFetch('/company', { method: 'PATCH', body: JSON.stringify(body) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');
  // Ime firme se prikazuje na početnoj (dashboard).
  revalidatePath('/');

  return { success: 'Podaci firme su sačuvani.' };
}

/** PATCH /company — numeracija i rok plaćanja (owner). */
export async function updateNumberingAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const numberingPrefix = textValue(formData, 'numberingPrefix');
  const numberingYear = integerValue(formData, 'numberingYear');
  const numberingNext = integerValue(formData, 'numberingNext');
  const defaultDueDays = integerValue(formData, 'defaultDueDays');

  if (numberingPrefix.length > 20) {
    return { error: 'Prefiks numeracije može imati najviše 20 znakova.' };
  }
  if (numberingYear === null || numberingYear < 2020 || numberingYear > 2100) {
    return { error: 'Godina numeracije mora biti između 2020 i 2100.' };
  }
  if (numberingNext === null || numberingNext < 1) {
    return { error: 'Sljedeći broj mora biti cijeli broj veći od 0.' };
  }
  if (defaultDueDays === null || defaultDueDays < 0 || defaultDueDays > 365) {
    return { error: 'Rok plaćanja mora biti cijeli broj između 0 i 365 dana.' };
  }

  const body = {
    numberingPrefix,
    numberingYear,
    numberingNext,
    defaultDueDays,
  };

  try {
    await apiFetch('/company', { method: 'PATCH', body: JSON.stringify(body) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: 'Numeracija je sačuvana.' };
}

/** POST /tax-rates — dodavanje porezne stope (owner); procenat se šalje u baznim poenima. */
export async function createTaxRateAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const name = textValue(formData, 'name');
  const ratePercent = decimalValue(formData, 'ratePercent');
  const sufCode = textValue(formData, 'sufCode');
  const active = formData.get('active') === 'on';

  if (!name) {
    return { error: 'Naziv porezne stope je obavezan.' };
  }
  if (name.length > 50) {
    return { error: 'Naziv porezne stope može imati najviše 50 znakova.' };
  }
  if (ratePercent === null || ratePercent < 0 || ratePercent > 100) {
    return { error: 'Procenat mora biti broj između 0 i 100.' };
  }
  if (!sufCode) {
    return { error: 'SUF kod je obavezan.' };
  }
  if (sufCode.length > 20) {
    return { error: 'SUF kod može imati najviše 20 znakova.' };
  }

  // 17 % → 1700 bp; API prima isključivo cijele bazne poene.
  const rateBp = Math.round(ratePercent * 100);

  const body = { name, rateBp, sufCode, active };

  try {
    await apiFetch('/tax-rates', { method: 'POST', body: JSON.stringify(body) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: 'Porezna stopa je dodana.' };
}

/** PUT /reminder-settings — plan i šablon automatskih podsjetnika (owner, max 4 stavke). */
export async function updateReminderSettingsAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const enabled = formData.get('enabled') === 'on';
  const templateText = textValue(formData, 'templateText');

  if (templateText.length < 10) {
    return { error: 'Šablon mora imati najmanje 10 znakova.' };
  }
  if (templateText.length > 500) {
    return { error: 'Šablon može imati najviše 500 znakova.' };
  }
  if (!templateText.includes('{broj}')) {
    return { error: 'Šablon mora sadržavati {broj}.' };
  }
  if (!templateText.includes('{iznos}')) {
    return { error: 'Šablon mora sadržavati {iznos}.' };
  }

  const offsetValues = formData.getAll('offsetDays');
  const kindValues = formData.getAll('kind');

  if (offsetValues.length > MAX_REMINDER_ITEMS) {
    return { error: 'Plan može imati najviše 4 automatska podsjetnika.' };
  }

  const schedule: ReminderScheduleItem[] = [];

  for (const [index, offsetValue] of offsetValues.entries()) {
    const rawOffset = String(offsetValue).trim();
    const offsetDays = rawOffset === '' ? Number.NaN : Number(rawOffset);
    const kind = String(kindValues[index] ?? '').trim();

    if (!Number.isInteger(offsetDays) || offsetDays < MIN_OFFSET_DAYS || offsetDays > MAX_OFFSET_DAYS) {
      return { error: 'Pomak dana mora biti cijeli broj između -30 i 30.' };
    }
    if (!kind) {
      return { error: 'Vrsta podsjetnika je obavezna.' };
    }
    if (kind.length > 30) {
      return { error: 'Vrsta podsjetnika može imati najviše 30 znakova.' };
    }

    schedule.push({ offsetDays, kind });
  }

  const body = {
    enabled,
    schedule,
    template: { text: templateText },
  };

  try {
    await apiFetch('/reminder-settings', { method: 'PUT', body: JSON.stringify(body) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: 'Podešavanja podsjetnika su sačuvana.' };
}
