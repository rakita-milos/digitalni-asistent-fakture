/**
 * Lokalna SQLite šema (§4: offline).
 * Kupci i fakture su read-model; `sync_queue` čuva lokalne izmjene do uspješnog push-a.
 */
export const SCHEMA_STATEMENTS: string[] = [
  'PRAGMA journal_mode = WAL',
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    jib TEXT,
    vatId TEXT,
    address TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    note TEXT,
    archivedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    status TEXT NOT NULL,
    customerId TEXT NOT NULL,
    customerName TEXT,
    issueDate TEXT,
    dueDate TEXT,
    totalFening INTEGER NOT NULL,
    paidFening INTEGER NOT NULL,
    updatedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    op TEXT NOT NULL,
    entityId TEXT NOT NULL,
    payload TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name)',
  'CREATE INDEX IF NOT EXISTS invoices_updated_idx ON invoices(updatedAt)',
  'CREATE INDEX IF NOT EXISTS sync_queue_status_idx ON sync_queue(status)',
];
