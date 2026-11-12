'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { formatFening } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/invoice-form';

import {
  cancelInvoiceAction,
  createPaymentAction,
  refundInvoiceAction,
  sendInvoiceAction,
  sendReminderAction,
} from './actions';

const PAYABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'];

interface InvoiceActionsProps {
  invoiceId: string;
  status: string;
  transactionType: string;
  totalFening: number;
  paidFening: number;
}

type Panel = 'payment' | 'refund' | 'cancel' | 'send' | null;

function parseAmountToFening(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));

  if (value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

/** M-08 akcije na web detalju: naplata, refundacija, poništenje i ručni podsjetnik. */
export function InvoiceActions({
  invoiceId,
  status,
  transactionType,
  totalFening,
  paidFening,
}: InvoiceActionsProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [sendChannel, setSendChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [sendTo, setSendTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outstandingFening = totalFening - paidFening;
  const payable = PAYABLE_STATUSES.includes(status);
  const canPay = payable && outstandingFening > 0;
  const canRefund = transactionType === 'SALE' && paidFening > 0 && status !== 'CANCELLED';
  const canCancel = transactionType === 'SALE' && paidFening === 0 && payable;
  const canRemind = payable;
  const canSend = true;

  function openPayment(): void {
    setPanel('payment');
    setAmount((outstandingFening / 100).toFixed(2));
    setMethod('CASH');
    setNote('');
    setError(null);
    setInfo(null);
  }

  function openRefund(): void {
    setPanel('refund');
    setAmount((paidFening / 100).toFixed(2));
    setNote('');
    setError(null);
    setInfo(null);
  }

  function handlePayment(): void {
    setError(null);
    const amountFening = parseAmountToFening(amount);

    if (amountFening === null) {
      setError('Unesite ispravan iznos veći od 0.');
      return;
    }
    if (amountFening > outstandingFening) {
      setError(`Iznos prelazi ostatak duga (${formatFening(outstandingFening)}).`);
      return;
    }

    startTransition(async () => {
      const result = await createPaymentAction(invoiceId, {
        amountFening,
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setPanel(null);
      setInfo('Naplata je sačuvana.');
      router.refresh();
    });
  }

  function handleRefund(): void {
    setError(null);
    const amountFening = parseAmountToFening(amount);

    if (amountFening === null) {
      setError('Unesite ispravan iznos veći od 0.');
      return;
    }
    if (amountFening > paidFening) {
      setError(`Refundacija ne može biti veća od naplaćenog (${formatFening(paidFening)}).`);
      return;
    }

    startTransition(async () => {
      const result = await refundInvoiceAction(invoiceId, {
        amountFening,
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setPanel(null);
      setInfo('Refundacija je kreirana.');
      router.refresh();
    });
  }

  function handleCancel(): void {
    setError(null);

    startTransition(async () => {
      const result = await cancelInvoiceAction(invoiceId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setPanel(null);
      setInfo('Faktura je poništena — kreira se VOID dokument.');
      router.refresh();
    });
  }

  function handleRemind(): void {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const result = await sendReminderAction(invoiceId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setInfo('Podsjetnik je poslan kupcu.');
      router.refresh();
    });
  }

  function openSend(): void {
    setPanel(panel === 'send' ? null : 'send');
    setSendChannel('EMAIL');
    setSendTo('');
    setError(null);
    setInfo(null);
  }

  function handleSend(): void {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const result = await sendInvoiceAction(invoiceId, {
        channel: sendChannel,
        ...(sendTo.trim() ? { to: sendTo.trim() } : {}),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setPanel(null);
      setInfo(sendChannel === 'EMAIL' ? 'Faktura je poslana e-mailom.' : 'Faktura je poslana SMS-om.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canPay ? (
          <button
            type="button"
            onClick={openPayment}
            disabled={isPending}
            className="rounded-[var(--radius-button)] bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Naplati
          </button>
        ) : null}
        {canRemind ? (
          <button
            type="button"
            onClick={handleRemind}
            disabled={isPending}
            className="rounded-[var(--radius-button)] border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60"
          >
            Pošalji podsjetnik
          </button>
        ) : null}
        {canSend ? (
          <button
            type="button"
            onClick={openSend}
            disabled={isPending}
            className="rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Pošalji
          </button>
        ) : null}
        {canRefund ? (
          <button
            type="button"
            onClick={openRefund}
            disabled={isPending}
            className="rounded-[var(--radius-button)] border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Refundiraj
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => {
              setPanel(panel === 'cancel' ? null : 'cancel');
              setError(null);
              setInfo(null);
            }}
            disabled={isPending}
            className="rounded-[var(--radius-button)] border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
          >
            Poništi
          </button>
        ) : null}
      </div>

      {error ? <p className="max-w-xs text-right text-xs text-danger">{error}</p> : null}
      {info ? <p className="max-w-xs text-right text-xs text-success">{info}</p> : null}

      {panel === 'send' ? (
        <div className="w-72 rounded-[var(--radius-card)] bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-sm font-semibold">Slanje fakture</p>
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="send-channel">
            Kanal
          </label>
          <select
            id="send-channel"
            value={sendChannel}
            onChange={(event) => setSendChannel(event.target.value as 'EMAIL' | 'SMS')}
            className="mb-2 w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="EMAIL">E-mail (PDF u prilogu)</option>
            <option value="SMS">SMS (kratkotrajni link)</option>
          </select>
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="send-to">
            Primalac (opciono)
          </label>
          <input
            id="send-to"
            value={sendTo}
            onChange={(event) => setSendTo(event.target.value)}
            maxLength={254}
            placeholder={sendChannel === 'EMAIL' ? 'kupac@firma.ba' : '+38766123456'}
            className="mb-2 w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
          />
          <p className="mb-3 text-xs text-foreground/50">
            Ako ostavite prazno, koristi se {sendChannel === 'EMAIL' ? 'e-mail' : 'telefon'} kupca sa
            fakture.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="rounded-[var(--radius-button)] bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? 'Šaljem…' : 'Pošalji'}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={isPending}
              className="text-sm text-foreground/60"
            >
              Odustani
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'payment' ? (
        <div className="w-72 rounded-[var(--radius-card)] bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-sm font-semibold">Naplata</p>
          <p className="mb-2 text-xs text-foreground/50">
            Ostatak duga: {formatFening(outstandingFening)}
          </p>
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="payment-amount">
            Iznos (KM)
          </label>
          <input
            id="payment-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="mb-2 w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="payment-method">
            Način plaćanja
          </label>
          <select
            id="payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mb-2 w-full rounded-[var(--radius-button)] border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABELS[option] ?? option}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="payment-note">
            Napomena
          </label>
          <input
            id="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            className="mb-3 w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePayment}
              disabled={isPending}
              className="rounded-[var(--radius-button)] bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? 'Čuvanje…' : 'Sačuvaj'}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={isPending}
              className="text-sm text-foreground/60"
            >
              Odustani
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'refund' ? (
        <div className="w-72 rounded-[var(--radius-card)] bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-sm font-semibold">Refundacija</p>
          <p className="mb-2 text-xs text-foreground/50">Naplaćeno: {formatFening(paidFening)}</p>
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="refund-amount">
            Iznos (KM)
          </label>
          <input
            id="refund-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="mb-2 w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="mb-1 block text-xs text-foreground/60" htmlFor="refund-note">
            Napomena
          </label>
          <input
            id="refund-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            className="mb-3 w-full rounded-[var(--radius-button)] border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefund}
              disabled={isPending}
              className="rounded-[var(--radius-button)] bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? 'Čuvanje…' : 'Sačuvaj'}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={isPending}
              className="text-sm text-foreground/60"
            >
              Odustani
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'cancel' ? (
        <div className="w-72 rounded-[var(--radius-card)] bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-sm font-semibold">Poništenje fakture</p>
          <p className="mb-3 text-xs text-foreground/60">
            Kreira se VOID dokument, a original prelazi u status „Poništeno“.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-[var(--radius-button)] bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? 'Poništavanje…' : 'Poništi fakturu'}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={isPending}
              className="text-sm text-foreground/60"
            >
              Odustani
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
