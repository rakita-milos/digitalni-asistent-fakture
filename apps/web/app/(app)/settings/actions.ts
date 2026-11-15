'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiFailure, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/session';

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

/** PATCH /company — numeracija i rok plaćanja (owner). */export async function updateNumberingAction(
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

/** Cijena iz forme („25,50“) → fening; `null` ako nije ispravan nenegativan broj. */
function priceFeningValue(formData: FormData): number | null {
  const price = decimalValue(formData, 'price');

  if (price === null) {
    return null;
  }

  const fening = Math.round(price * 100);
  return Number.isSafeInteger(fening) && fening >= 0 ? fening : null;
}

type ItemFields = { name: string; unit: string; priceFening: number; taxRateBp: number };

/** Zajednička validacija forme artikla (POST i PATCH /items). */
function itemFieldsFromForm(formData: FormData): ItemFields | { error: string } {
  const name = textValue(formData, 'name');
  const unit = textValue(formData, 'unit');
  const priceFening = priceFeningValue(formData);
  const taxRateBp = integerValue(formData, 'taxRateBp');

  if (!name) {
    return { error: 'Naziv artikla je obavezan.' };
  }
  if (name.length > 200) {
    return { error: 'Naziv artikla može imati najviše 200 znakova.' };
  }
  if (!unit) {
    return { error: 'Jedinica je obavezna (npr. kom, sat).' };
  }
  if (unit.length > 20) {
    return { error: 'Jedinica može imati najviše 20 znakova.' };
  }
  if (priceFening === null) {
    return { error: 'Cijena mora biti broj veći ili jednak 0.' };
  }
  if (taxRateBp === null || taxRateBp < 0 || taxRateBp > 10000) {
    return { error: 'Odaberite poreznu stopu.' };
  }

  return { name, unit, priceFening, taxRateBp };
}

/** POST /items — novi artikal u katalogu (owner/worker). */
export async function createItemAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const fields = itemFieldsFromForm(formData);

  if ('error' in fields) {
    return fields;
  }

  try {
    await apiFetch('/items', { method: 'POST', body: JSON.stringify(fields) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: 'Artikal je dodan u katalog.' };
}

/** PATCH /items/:id — izmjena artikla; cijena ide u feningu. */
export async function updateItemAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const itemId = textValue(formData, 'itemId');

  if (!itemId) {
    return { error: 'Artikal nije odabran.' };
  }

  const fields = itemFieldsFromForm(formData);

  if ('error' in fields) {
    return fields;
  }

  try {
    await apiFetch(`/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(fields) });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: 'Artikal je sačuvan.' };
}

/** PATCH /items/:id — arhiviranje (`archivedAt`) ili vraćanje iz arhive; §6 nema DELETE. */
export async function archiveItemAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const itemId = textValue(formData, 'itemId');
  const restore = formData.get('restore') === '1';

  if (!itemId) {
    return { error: 'Artikal nije odabran.' };
  }

  try {
    await apiFetch(`/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archivedAt: restore ? null : new Date().toISOString() }),
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath('/settings');

  return { success: restore ? 'Artikal je vraćen u katalog.' : 'Artikal je arhiviran.' };
}

/** Dispečer za formu artikla: „Sačuvaj“ ide PATCH sa poljima, „Arhiviraj“ samo mijenja `archivedAt`. */
export async function itemRowAction(
  previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  if (formData.get('intent') === 'archive') {
    return archiveItemAction(previous, formData);
  }

  return updateItemAction(previous, formData);
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

/**
 * GDPR brisanje naloga (owner, §10/§21.12).
 * Poslije uspjeha brišu se cookie-ji i korisnik ide na prijavu.
 */
export async function deleteAccountAction(confirmation: string): Promise<{ error?: string }> {
  try {
    await apiFetch<{ deleted: true }>('/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation }),
    });
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        redirect('/login');
      }
      return { error: error.message };
    }
    throw error;
  }

  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/login?deleted=1');
}
