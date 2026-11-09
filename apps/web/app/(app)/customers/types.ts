/** Zajednički tipovi za web stranice kupaca (W-06). */

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  jib: string | null;
  vatId: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  archivedAt: string | null;
}

export interface CustomerList {
  items: Customer[];
  total: number;
}

/** Stanje server akcija za formu kupca (`useActionState`). */
export interface CustomerFormState {
  error?: string;
}
