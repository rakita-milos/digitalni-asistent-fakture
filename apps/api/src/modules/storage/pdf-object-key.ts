import { createHash } from 'node:crypto';

/** Content-addressed ključ: isti PDF = isti objekat; izmjena drafta mijenja ključ. */
export function pdfObjectKey(companyId: string, invoiceId: string, buffer: Buffer): string {
  const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  return `pdf/invoices/${companyId}/${invoiceId}-${digest}.pdf`;
}
