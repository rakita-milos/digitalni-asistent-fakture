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
