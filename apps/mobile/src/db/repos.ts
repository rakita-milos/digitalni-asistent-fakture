import type { SqlDb } from './localDb';

export interface LocalCustomer {
  id: string;
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

export interface LocalInvoice {
  id: string;
  number: string;
  status: string;
  customerId: string;
  customerName: string | null;
  issueDate: string;
  dueDate: string;
  totalFening: number;
  paidFening: number;
  updatedAt: string;
}

export async function upsertCustomers(db: SqlDb, customers: LocalCustomer[]): Promise<void> {
  for (const customer of customers) {
    await db.execute(
      `INSERT OR REPLACE INTO customers (id, name, jib, vatId, address, city, phone, email, note, archivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.jib,
        customer.vatId,
        customer.address,
        customer.city,
        customer.phone,
        customer.email,
        customer.note,
        customer.archivedAt,
      ],
    );
  }
}

export async function upsertInvoices(db: SqlDb, invoices: LocalInvoice[]): Promise<void> {
  for (const invoice of invoices) {
    await db.execute(
      `INSERT OR REPLACE INTO invoices (id, number, status, customerId, customerName, issueDate, dueDate, totalFening, paidFening, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.id,
        invoice.number,
        invoice.status,
        invoice.customerId,
        invoice.customerName,
        invoice.issueDate,
        invoice.dueDate,
        invoice.totalFening,
        invoice.paidFening,
        invoice.updatedAt,
      ],
    );
  }
}

export async function listCustomers(db: SqlDb, search?: string): Promise<LocalCustomer[]> {
  const term = search?.trim();
  if (!term) {
    return db.query<LocalCustomer>('SELECT * FROM customers ORDER BY name ASC');
  }

  const like = `%${term}%`;
  return db.query<LocalCustomer>(
    `SELECT * FROM customers
     WHERE name LIKE ? OR city LIKE ? OR phone LIKE ? OR jib LIKE ? OR email LIKE ?
     ORDER BY name ASC`,
    [like, like, like, like, like],
  );
}

export async function getCustomer(db: SqlDb, id: string): Promise<LocalCustomer | null> {
  const rows = await db.query<LocalCustomer>('SELECT * FROM customers WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function listInvoices(db: SqlDb): Promise<LocalInvoice[]> {
  return db.query<LocalInvoice>('SELECT * FROM invoices ORDER BY updatedAt DESC LIMIT 100');
}

export async function saveCustomer(
  db: SqlDb,
  customer: Omit<LocalCustomer, 'archivedAt'>,
): Promise<void> {
  await upsertCustomers(db, [{ ...customer, archivedAt: null }]);
}

/** `meta` tabela — lokalno stanje koje nije dio sync-a (npr. napredak setup-a). */
export async function getMeta(db: SqlDb, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: SqlDb, key: string, value: string): Promise<void> {
  await db.execute('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}

/**
 * Keš detalja fakture (M-08 offline): posljednji uspješno učitani detalj.
 * Nije dio sync-a — služi samo za prikaz kad nema mreže.
 */
export async function saveInvoiceDetail(
  db: SqlDb,
  invoiceId: string,
  payload: unknown,
): Promise<void> {
  await db.execute(
    'INSERT OR REPLACE INTO invoice_details (invoiceId, payload, cachedAt) VALUES (?, ?, ?)',
    [invoiceId, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function getInvoiceDetail<T>(db: SqlDb, invoiceId: string): Promise<T | null> {
  const rows = await db.query<{ payload: string }>(
    'SELECT payload FROM invoice_details WHERE invoiceId = ?',
    [invoiceId],
  );
  const payload = rows[0]?.payload;

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
