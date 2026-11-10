import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';

import { apiFetch, ApiFailure } from '@/lib/api';
import { formatDate, formatFening, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';
import { INVOICE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/invoice-form';

import { IssueInvoiceButton } from '../issue-button';
import { ConvertInvoiceButton } from '../convert-button';
import { InvoiceActions } from '../invoice-actions';

interface InvoiceLineDto {
  id: string;
  description: string;
  qtyMilli: number;
  unitPriceFening: number;
  discountBp: number;
  taxRateBp: number;
  lineSubtotalFening: number;
  lineTaxFening: number;
  lineTotalFening: number;
}

interface PaymentDto {
  id: string;
  amountFening: number;
  method: string;
  paidAt: string;
  note: string | null;
}

interface InvoiceDetailDto {
  id: string;
  number: string;
  type: string;
  transactionType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalFening: number;
  taxFening: number;
  totalFening: number;
  paidFening: number;
  note: string | null;
  paymentMethod: string | null;
  fiscalPfr: string | null;
  fiscalQrPayload: string | null;
  fiscalAt: string | null;
  customer: { id: string; name: string };
  lines: InvoiceLineDto[];
  payments: PaymentDto[];
}

function formatPercent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

function formatQty(qtyMilli: number): string {
  return (qtyMilli / 1000).toLocaleString('bs-BA', { maximumFractionDigits: 3 });
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let invoice: InvoiceDetailDto;

  try {
    invoice = await apiFetch<InvoiceDetailDto>(`/invoices/${id}`);
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        redirect('/login');
      }
      if (error.status === 404) {
        notFound();
      }
    }
    throw error;
  }

  let qrDataUrl: string | null = null;
  if (invoice.fiscalQrPayload) {
    try {
      qrDataUrl = await QRCode.toDataURL(invoice.fiscalQrPayload, { width: 180, margin: 1 });
    } catch {
      // Ako QR ne može da se generiše, PDF i dalje sadrži ispravan QR.
      qrDataUrl = null;
    }
  }

  const outstandingFening = invoice.totalFening - invoice.paidFening;
  const isDraft = invoice.status === 'DRAFT';
  const isProforma = invoice.type === 'ADVANCE';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{invoice.number}</h1>
            <span
              className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLES[invoice.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
            {isProforma ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                {INVOICE_TYPE_LABELS['ADVANCE'] ?? 'PRAČUN'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-foreground/60">
            <Link href={`/customers/${invoice.customer.id}`} className="hover:text-primary">
              {invoice.customer.name}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isDraft ? (
            <Link
              href={`/invoices/${invoice.id}/edit`}
              className="rounded-[var(--radius-button)] border border-primary px-3 py-2 text-sm font-semibold text-primary"
            >
              Uredi draft
            </Link>
          ) : null}
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-sm font-semibold"
          >
            PDF / štampa
          </a>
          {isDraft && !isProforma ? <IssueInvoiceButton invoiceId={invoice.id} /> : null}
          {isDraft && isProforma ? <ConvertInvoiceButton invoiceId={invoice.id} /> : null}
        </div>
      </div>

      {!isDraft && invoice.status !== 'CANCELLED' ? (
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          transactionType={invoice.transactionType}
          totalFening={invoice.totalFening}
          paidFening={invoice.paidFening}
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Datum izdavanja</p>
          <p className="mt-1 font-medium">{formatDate(invoice.issueDate)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Rok plaćanja</p>
          <p className="mt-1 font-medium">{formatDate(invoice.dueDate)}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Način plaćanja</p>
          <p className="mt-1 font-medium">
            {invoice.paymentMethod
              ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod)
              : '—'}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-foreground/50">Valuta</p>
          <p className="mt-1 font-medium">{invoice.currency}</p>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-lg font-semibold">Stavke</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Opis</th>
                <th className="py-2 pr-3 text-right font-medium">Količina</th>
                <th className="py-2 pr-3 text-right font-medium">Cijena</th>
                <th className="py-2 pr-3 text-right font-medium">Popust</th>
                <th className="py-2 pr-3 text-right font-medium">PDV</th>
                <th className="py-2 text-right font-medium">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={line.id} className="border-t border-black/5">
                  <td className="py-2 pr-3 text-foreground/50">{index + 1}</td>
                  <td className="py-2 pr-3">{line.description}</td>
                  <td className="py-2 pr-3 text-right">{formatQty(line.qtyMilli)}</td>
                  <td className="py-2 pr-3 text-right">{formatFening(line.unitPriceFening)}</td>
                  <td className="py-2 pr-3 text-right">
                    {line.discountBp > 0 ? formatPercent(line.discountBp) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">{formatPercent(line.taxRateBp)}</td>
                  <td className="py-2 text-right font-medium">{formatFening(line.lineTotalFening)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground/60">Osnovica</dt>
            <dd>{formatFening(invoice.subtotalFening)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-foreground/60">PDV</dt>
            <dd>{formatFening(invoice.taxFening)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base font-semibold">
            <dt>Ukupno</dt>
            <dd>{formatFening(invoice.totalFening)}</dd>
          </div>
          {invoice.paidFening > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-foreground/60">Naplaćeno</dt>
                <dd>{formatFening(invoice.paidFening)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Ostatak</dt>
                <dd>{formatFening(outstandingFening)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        {invoice.note ? (
          <p className="mt-4 rounded-[var(--radius-button)] bg-black/[0.03] p-3 text-sm text-foreground/70">
            {invoice.note}
          </p>
        ) : null}
      </section>

      {invoice.fiscalAt ? (
        <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-lg font-semibold">Fiskalizacija</h2>
          <div className="flex flex-wrap items-start gap-6">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-foreground/50">PFR</dt>
                <dd className="font-mono text-xs break-all">{invoice.fiscalPfr ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-foreground/50">Vrijeme fiskalizacije</dt>
                <dd>{formatDate(invoice.fiscalAt)}</dd>
              </div>
            </dl>
            {qrDataUrl ? (
              <figure className="text-center">
                <Image src={qrDataUrl} alt="QR kod fiskalnog računa" width={160} height={160} unoptimized />
                <figcaption className="mt-1 text-xs text-foreground/50">QR za provjeru računa</figcaption>
              </figure>
            ) : null}
          </div>
        </section>
      ) : isProforma ? (
        <p className="text-sm text-foreground/60">
          PRAČUN nije fiskalni dokument — ne dobija PFR ni QR.
        </p>
      ) : null}

      {invoice.payments.length > 0 ? (
        <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-lg font-semibold">Naplate</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="py-2 pr-3 font-medium">Datum</th>
                <th className="py-2 pr-3 font-medium">Način</th>
                <th className="py-2 pr-3 font-medium">Napomena</th>
                <th className="py-2 text-right font-medium">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id} className="border-t border-black/5">
                  <td className="py-2 pr-3">{formatDate(payment.paidAt)}</td>
                  <td className="py-2 pr-3">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </td>
                  <td className="py-2 pr-3 text-foreground/60">{payment.note ?? '—'}</td>
                  <td className="py-2 text-right font-medium">{formatFening(payment.amountFening)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <Link href="/invoices" className="inline-block text-sm text-foreground/60 hover:text-primary">
        ← Nazad na fakture
      </Link>
    </div>
  );
}
