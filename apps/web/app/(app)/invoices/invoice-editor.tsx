'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';

import { formatFening } from '@/lib/format';
import {
  addDaysInputValue,
  feningToPriceInput,
  INVOICE_TYPE_LABELS,
  parsePercentToBp,
  parsePriceToFening,
  parseQtyToMilli,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  taxRateBpToPercentInput,
  toApiDateTime,
  todayInputValue,
} from '@/lib/invoice-form';
import type {
  CustomerOption,
  InvoiceEditorInitial,
  InvoiceEditorLine,
  InvoiceFormLine,
  InvoiceFormPayload,
  InvoiceType,
  ItemOption,
  TaxRateOption,
} from '@/lib/invoice-form';
import { calculatePreviewLine, calculatePreviewTotals } from '@/lib/invoice-preview';

import { createInvoiceAction, updateInvoiceAction } from './actions';

interface EditorLine extends InvoiceEditorLine {
  key: string;
  itemId: string;
}

interface InvoiceEditorProps {
  mode: 'create' | 'edit';
  initial?: InvoiceEditorInitial;
  customers: CustomerOption[];
  items: ItemOption[];
  taxRates: TaxRateOption[];
  defaultDueDays: number;
}

function createEditorLine(defaultTaxPercent: string, line?: InvoiceEditorLine): EditorLine {
  return {
    key: crypto.randomUUID(),
    itemId: '',
    description: line?.description ?? '',
    qty: line?.qty ?? '1',
    price: line?.price ?? '0.00',
    discountPercent: line?.discountPercent ?? '0',
    taxPercent: line?.taxPercent ?? defaultTaxPercent,
  };
}

/** Jedna linija forme → ulaz za preview obračun (null ako unos nije validan). */
function toPreviewInput(line: EditorLine) {
  const qtyMilli = parseQtyToMilli(line.qty);
  const unitPriceFening = parsePriceToFening(line.price);
  const taxRateBp = parsePercentToBp(line.taxPercent);
  const discountBp =
    line.discountPercent.trim() === '' ? 0 : parsePercentToBp(line.discountPercent);

  if (qtyMilli === null || unitPriceFening === null || taxRateBp === null || discountBp === null) {
    return null;
  }

  return { qtyMilli, unitPriceFening, taxRateBp, discountBp };
}

/** M-05/W-04 forma: podaci o fakturi + stavke + live obračun (§7.2, §7.3). */
export function InvoiceEditor({
  mode,
  initial,
  customers,
  items,
  taxRates,
  defaultDueDays,
}: InvoiceEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Stabilan ključ za deduplikaciju duplog slanja / retry-ja iste forme (§6, §21).
  const idempotencyKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTaxRate = taxRates.find((rate) => rate.active) ?? taxRates[0];
  const defaultTaxPercent = activeTaxRate ? taxRateBpToPercentInput(activeTaxRate.rateBp) : '17';

  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? '');
  const [type, setType] = useState<InvoiceType>(initial?.type ?? 'SALE');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayInputValue());
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? addDaysInputValue(todayInputValue(), defaultDueDays),
  );
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [lines, setLines] = useState<EditorLine[]>(() => {
    if (initial && initial.lines.length > 0) {
      return initial.lines.map((line) => createEditorLine(defaultTaxPercent, line));
    }
    return [createEditorLine(defaultTaxPercent)];
  });

  const totals = useMemo(
    () =>
      calculatePreviewTotals(
        lines.flatMap((line) => {
          const input = toPreviewInput(line);
          return input ? [input] : [];
        }),
      ),
    [lines],
  );

  function updateLine(key: string, patch: Partial<EditorLine>): void {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function handleItemChange(key: string, itemId: string): void {
    const item = items.find((candidate) => candidate.id === itemId);

    if (!item) {
      updateLine(key, { itemId: '' });
      return;
    }

    updateLine(key, {
      itemId,
      description: item.name,
      price: feningToPriceInput(item.priceFening),
      taxPercent: taxRateBpToPercentInput(item.taxRateBp),
    });
  }

  function handleSubmit(): void {
    setError(null);

    if (!customerId) {
      setError('Izaberite kupca.');
      return;
    }

    const payloadLines: InvoiceFormLine[] = [];

    for (const [index, line] of lines.entries()) {
      const qtyMilli = parseQtyToMilli(line.qty);
      const unitPriceFening = parsePriceToFening(line.price);
      const taxRateBp = parsePercentToBp(line.taxPercent);
      const discountBp =
        line.discountPercent.trim() === '' ? 0 : parsePercentToBp(line.discountPercent);
      const position = index + 1;

      if (line.description.trim() === '') {
        setError(`Stavka ${position}: opis je obavezan.`);
        return;
      }
      if (qtyMilli === null) {
        setError(`Stavka ${position}: količina mora biti veća od 0.`);
        return;
      }
      if (unitPriceFening === null) {
        setError(`Stavka ${position}: cijena nije ispravna.`);
        return;
      }
      if (taxRateBp === null) {
        setError(`Stavka ${position}: PDV stopa mora biti između 0 i 100 %.`);
        return;
      }
      if (discountBp === null) {
        setError(`Stavka ${position}: popust mora biti između 0 i 100 %.`);
        return;
      }

      payloadLines.push({
        description: line.description.trim(),
        qtyMilli,
        unitPriceFening,
        taxRateBp,
        discountBp,
      });
    }

    if (payloadLines.length === 0) {
      setError('Dodajte najmanje jednu stavku.');
      return;
    }

    if (!issueDate || !dueDate) {
      setError('Datumi izdavanja i dospijeća su obavezni.');
      return;
    }

    const issueDateIso = toApiDateTime(issueDate);
    const dueDateIso = toApiDateTime(dueDate);

    if (new Date(dueDateIso).getTime() < new Date(issueDateIso).getTime()) {
      setError('Datum dospijeća ne može biti prije datuma izdavanja.');
      return;
    }

    const payload: InvoiceFormPayload = {
      customerId,
      type,
      issueDate: issueDateIso,
      dueDate: dueDateIso,
      lines: payloadLines,
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    startTransition(async () => {
      if (mode === 'edit' && initial) {
        const result = await updateInvoiceAction(initial.id, payload);

        if (result.error) {
          setError(result.error);
          return;
        }
        if (!result.id) {
          setError('Neočekivana greška — izmjene nisu sačuvane.');
          return;
        }

        router.push(`/invoices/${result.id}`);
        router.refresh();
        return;
      }

      idempotencyKeyRef.current ??= crypto.randomUUID();
      const result = await createInvoiceAction(payload, idempotencyKeyRef.current);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.id) {
        setError('Neočekivana greška — faktura nije sačuvana.');
        return;
      }

      router.push(`/invoices/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {customers.length === 0 ? (
        <p className="rounded-[var(--radius-button)] bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Nema kupaca. Prvo <Link href="/customers/new" className="font-semibold underline">dodajte kupca</Link>, pa
          kreirajte fakturu.
        </p>
      ) : null}

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold">Podaci o fakturi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Kupac</span>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            >
              <option value="">— izaberite kupca —</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Tip dokumenta</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value === 'ADVANCE' ? 'ADVANCE' : 'SALE')}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            >
              <option value="SALE">{INVOICE_TYPE_LABELS['SALE'] ?? 'Račun'}</option>
              <option value="ADVANCE">{INVOICE_TYPE_LABELS['ADVANCE'] ?? 'PRAČUN'}</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Datum izdavanja</span>
            <input
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Datum dospijeća</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Način plaćanja</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            >
              <option value="">— nije određeno —</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method] ?? method}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-foreground/60">Napomena</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stavke</h2>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, createEditorLine(defaultTaxPercent)])}
            className="rounded-[var(--radius-button)] border border-primary px-3 py-1.5 text-sm font-semibold text-primary"
          >
            Dodaj stavku
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const previewInput = toPreviewInput(line);
            const lineTotal = previewInput ? calculatePreviewLine(previewInput).totalFening : null;

            return (
              <div
                key={line.key}
                className="rounded-[var(--radius-button)] border border-gray-200 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-12">
                  <label className="block text-sm sm:col-span-3">
                    <span className="mb-1 block text-xs text-foreground/50">Artikal</span>
                    <select
                      value={line.itemId}
                      onChange={(event) => handleItemChange(line.key, event.target.value)}
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— ručno —</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm sm:col-span-3">
                    <span className="mb-1 block text-xs text-foreground/50">
                      Opis (stavka {index + 1})
                    </span>
                    <input
                      type="text"
                      value={line.description}
                      maxLength={500}
                      onChange={(event) => updateLine(line.key, { description: event.target.value })}
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1 block text-xs text-foreground/50">Kol.</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(event) => updateLine(line.key, { qty: event.target.value })}
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-xs text-foreground/50">Cijena (KM)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.price}
                      onChange={(event) => updateLine(line.key, { price: event.target.value })}
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1 block text-xs text-foreground/50">Popust %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.discountPercent}
                      onChange={(event) =>
                        updateLine(line.key, { discountPercent: event.target.value })
                      }
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1 block text-xs text-foreground/50">PDV %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.taxPercent}
                      onChange={(event) => updateLine(line.key, { taxPercent: event.target.value })}
                      className="w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) =>
                          current.length === 1
                            ? current
                            : current.filter((candidate) => candidate.key !== line.key),
                        )
                      }
                      disabled={lines.length === 1}
                      className="rounded-[var(--radius-button)] border border-danger px-2 py-1.5 text-xs font-semibold text-danger disabled:opacity-40"
                      aria-label="Ukloni stavku"
                    >
                      Ukloni
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-right text-xs text-foreground/60">
                  Iznos: <span className="font-semibold text-foreground">{formatFening(lineTotal ?? 0)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-lg font-semibold">Sažetak</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground/60">Osnovica</dt>
            <dd>{formatFening(totals.subtotalFening)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-foreground/60">PDV</dt>
            <dd>{formatFening(totals.taxFening)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base font-semibold">
            <dt>Ukupno</dt>
            <dd>{formatFening(totals.totalFening)}</dd>
          </div>
        </dl>

        {type === 'ADVANCE' ? (
          <p className="mt-3 text-xs text-foreground/50">
            PRAČUN se ne fiskalizuje; nakon čuvanja se može konvertovati u draft račun na detalju.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-[var(--radius-button)] bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {isPending ? 'Čuvanje…' : 'Sačuvaj draft'}
          </button>
          <Link
            href={initial ? `/invoices/${initial.id}` : '/invoices'}
            className="text-sm text-foreground/60 hover:text-primary"
          >
            Otkaži
          </Link>
        </div>
      </section>
    </div>
  );
}
