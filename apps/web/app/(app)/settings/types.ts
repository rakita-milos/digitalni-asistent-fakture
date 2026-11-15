/** Zajednički tipovi za web stranicu podešavanja (W-08). */

/** GET /company — profil firme (§6). `logoUrl` i `efdId` su jedina nullabilna polja. */
export interface CompanySettings {
  id: string;
  name: string;
  jib: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  efdId: string | null;
  numberingPrefix: string;
  numberingYear: number;
  numberingNext: number;
  defaultDueDays: number;
  createdAt: string;
}

/** Porezna stopa — iznos je u baznim poenima (17 % = 1700 bp). */
export interface TaxRate {
  id: string;
  companyId: string;
  name: string;
  rateBp: number;
  sufCode: string;
  active: boolean;
}

export interface TaxRateList {
  items: TaxRate[];
  total: number;
}

/** Artikal iz kataloga (GET /items) — cijena je u feningu. */
export interface Item {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  priceFening: number;
  taxRateBp: number;
  archivedAt: string | null;
}

export interface ItemList {
  items: Item[];
  total: number;
}

/** Jedna stavka plana automatskih podsjetnika (§7.9). */
export interface ReminderScheduleItem {
  offsetDays: number;
  kind: string;
}

/** GET /reminder-settings (owner). */
export interface ReminderSettings {
  enabled: boolean;
  schedule: ReminderScheduleItem[];
  template: { text: string };
  senderId: string | null;
}

/** Stanje server akcija za sve forme podešavanja (`useActionState`). */
export interface SettingsFormState {
  error?: string;
  success?: string;
}
