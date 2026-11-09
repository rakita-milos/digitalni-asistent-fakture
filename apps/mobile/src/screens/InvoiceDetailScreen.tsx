import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { PaymentMethod } from '@digitalni-asistent/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../api/client';
import {
  cancelInvoice,
  createPayment,
  getInvoice,
  issueInvoice,
  refundInvoice,
  type InvoiceDetailDto,
} from '../api/invoices';
import { sendInvoiceReminder } from '../api/reminders';
import {
  formatDate,
  formatFening,
  formatPercent,
  formatQty,
  INVOICE_TYPE_LABELS,
  isPayable,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../utils/invoiceFormat';
import { feningToPriceInput, parsePriceFening } from '../utils/invoiceMath';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>;

/**
 * M-08 Detalj fakture (+ M-07 rezultat fiskalizacije).
 * Akcije na ovoj verziji: izdavanje, naplata i poništenje.
 * Refundacija i QR slika na telefonu ostaju za naredni korak (vidi PROGRESS).
 */
export function InvoiceDetailScreen({ route }: Props) {
  const { invoiceId, notice } = route.params;

  const [invoice, setInvoice] = useState<InvoiceDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [refundVisible, setRefundVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getInvoice(invoiceId);
      setInvoice(data);
      setLoadError(null);
    } catch (caught) {
      setLoadError(
        caught instanceof ApiError ? caught.message : 'Faktura nije učitana. Provjerite mrežu.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load]),
  );

  async function handleIssue(): Promise<void> {
    setActionError(null);
    setIsBusy(true);

    try {
      await issueInvoice(invoiceId);
      setInfoMessage('Faktura je izdata i fiskalizovana.');
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : 'Izdavanje nije uspjelo. Provjerite mrežu.',
      );
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemind(): Promise<void> {
    setActionError(null);
    setInfoMessage(null);
    setIsBusy(true);

    try {
      await sendInvoiceReminder(invoiceId);
      setInfoMessage('Podsjetnik je poslan kupcu.');
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : 'Podsjetnik nije poslan. Provjerite mrežu.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancel(): Promise<void> {
    setActionError(null);
    setInfoMessage(null);
    setIsBusy(true);

    try {
      await cancelInvoice(invoiceId);
      setInfoMessage('Faktura je poništena — kreira se VOID dokument.');
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : 'Poništenje nije uspjelo. Provjerite mrežu.',
      );
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  function confirmCancel(): void {
    Alert.alert(
      'Poništi fakturu?',
      'Umjesto brisanja kreira se VOID dokument, a original prelazi u status „Poništeno“.',
      [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Poništi', style: 'destructive', onPress: () => void handleCancel() },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" />
      </View>
    );
  }

  if (loadError || !invoice) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError ?? 'Faktura nije pronađena.'}</Text>
      </View>
    );
  }

  const outstandingFening = invoice.totalFening - invoice.paidFening;
  const isDraft = invoice.status === 'DRAFT';
  const isProforma = invoice.type === 'ADVANCE';
  const canPay = isPayable(invoice.status) && outstandingFening > 0;
  const canRemind = isPayable(invoice.status);
  const canRefund =
    invoice.transactionType === 'SALE' && invoice.paidFening > 0 && invoice.status !== 'CANCELLED';
  const canCancel =
    invoice.transactionType === 'SALE' &&
    invoice.paidFening === 0 &&
    isPayable(invoice.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={styles.number}>{invoice.number}</Text>
            {isProforma ? (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {INVOICE_TYPE_LABELS['ADVANCE'] ?? 'PRAČUN'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.status, { color: STATUS_COLORS[invoice.status] ?? '#1F2937' }]}>
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </Text>
        </View>

        <Text style={styles.customer}>{invoice.customer.name}</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Izdato</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rok</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Plaćanje</Text>
            <Text style={styles.metaValue}>
              {invoice.paymentMethod
                ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod)
                : '—'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Valuta</Text>
            <Text style={styles.metaValue}>{invoice.currency}</Text>
          </View>
        </View>

        {invoice.note ? <Text style={styles.note}>{invoice.note}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stavke</Text>
        {invoice.lines.map((line, index) => (
          <View key={line.id} style={styles.lineRow}>
            <View style={styles.lineMain}>
              <Text style={styles.lineDescription}>
                {index + 1}. {line.description}
              </Text>
              <Text style={styles.metaSmall}>
                {formatQty(line.qtyMilli)} × {formatFening(line.unitPriceFening)}
                {line.discountBp > 0 ? ` · popust ${formatPercent(line.discountBp)}` : ''} · PDV{' '}
                {formatPercent(line.taxRateBp)}
              </Text>
            </View>
            <Text style={styles.lineAmount}>{formatFening(line.lineTotalFening)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Osnovica</Text>
            <Text style={styles.totalValue}>{formatFening(invoice.subtotalFening)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>PDV</Text>
            <Text style={styles.totalValue}>{formatFening(invoice.taxFening)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowStrong]}>
            <Text style={styles.totalLabelStrong}>Ukupno</Text>
            <Text style={styles.totalValueStrong}>{formatFening(invoice.totalFening)}</Text>
          </View>
          {invoice.paidFening > 0 ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Naplaćeno</Text>
                <Text style={styles.totalValue}>{formatFening(invoice.paidFening)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Ostatak</Text>
                <Text style={styles.totalValue}>{formatFening(outstandingFening)}</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {invoice.fiscalPfr ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fiskalizacija</Text>
          <Text style={styles.metaLabel}>PFR</Text>
          <Text selectable style={styles.pfr}>
            {invoice.fiscalPfr}
          </Text>
          {invoice.fiscalAt ? (
            <Text style={styles.metaSmall}>Fiskalizovano: {formatDate(invoice.fiscalAt)}</Text>
          ) : null}
          <Text style={styles.hint}>
            QR kod fiskalnog računa je u PDF-u fakture (web/štampa) — prikaz QR-a na telefonu
            dolazi sa narednim sprintevima.
          </Text>
        </View>
      ) : invoice.status === 'PENDING_FISCAL' ? (
        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.warningTitle}>Fiskalizacija nije potvrđena</Text>
          <Text style={styles.warningText}>
            ESIR nije potvrdio račun. Worker automatski ponavlja fiskalizaciju (backoff do 6 h,
            max 5 pokušaja).
          </Text>
        </View>
      ) : null}

      {invoice.payments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Naplate</Text>
          {invoice.payments.map((payment) => (
            <View key={payment.id} style={styles.paymentRow}>
              <View style={styles.lineMain}>
                <Text style={styles.paymentLabel}>
                  {formatDate(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                </Text>
                {payment.note ? <Text style={styles.metaSmall}>{payment.note}</Text> : null}
              </View>
              <Text style={styles.lineAmount}>{formatFening(payment.amountFening)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      {infoMessage ? <Text style={styles.successNotice}>{infoMessage}</Text> : null}

      {isDraft && !isProforma ? (
        <Pressable
          style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
          onPress={() => void handleIssue()}
          disabled={isBusy}
          testID="detail-issue"
        >
          <Text style={styles.primaryButtonText}>
            {isBusy ? 'Izdavanje…' : 'Izdaj i fiskalizuj'}
          </Text>
        </Pressable>
      ) : null}

      {canPay ? (
        <Pressable
          style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
          onPress={() => setPaymentVisible(true)}
          disabled={isBusy}
          testID="detail-pay"
        >
          <Text style={styles.primaryButtonText}>Naplati</Text>
        </Pressable>
      ) : null}

      {canRemind ? (
        <Pressable
          style={[styles.secondaryButton, isBusy && styles.buttonDisabled]}
          onPress={() => void handleRemind()}
          disabled={isBusy}
          testID="detail-remind"
        >
          <Text style={styles.secondaryButtonText}>Pošalji podsjetnik (SMS)</Text>
        </Pressable>
      ) : null}

      {canRefund ? (
        <Pressable
          style={[styles.secondaryButton, isBusy && styles.buttonDisabled]}
          onPress={() => setRefundVisible(true)}
          disabled={isBusy}
          testID="detail-refund"
        >
          <Text style={styles.secondaryButtonText}>Refundiraj</Text>
        </Pressable>
      ) : null}

      {canCancel ? (
        <Pressable
          style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
          onPress={confirmCancel}
          disabled={isBusy}
          testID="detail-cancel"
        >
          <Text style={styles.dangerButtonText}>Poništi fakturu</Text>
        </Pressable>
      ) : null}

      {paymentVisible ? (
        <PaymentModal
          invoiceId={invoice.id}
          outstandingFening={outstandingFening}
          onClose={() => setPaymentVisible(false)}
          onSaved={() => {
            setPaymentVisible(false);
            setInfoMessage('Naplata je sačuvana.');
            void load();
          }}
        />
      ) : null}

      {refundVisible ? (
        <RefundModal
          invoiceId={invoice.id}
          paidFening={invoice.paidFening}
          onClose={() => setRefundVisible(false)}
          onSaved={() => {
            setRefundVisible(false);
            setInfoMessage('Refundacija je kreirana (novi REFUND dokument).');
            void load();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

interface PaymentModalProps {
  invoiceId: string;
  outstandingFening: number;
  onClose: () => void;
  onSaved: () => void;
}

function PaymentModal({ invoiceId, outstandingFening, onClose, onSaved }: PaymentModalProps) {
  const [amount, setAmount] = useState(() => feningToPriceInput(outstandingFening));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleSubmit(): void {
    setError(null);
    const amountFening = parsePriceFening(amount);

    if (amountFening === null || amountFening < 1) {
      setError('Unesite ispravan iznos veći od 0.');
      return;
    }
    if (amountFening > outstandingFening) {
      setError(`Iznos prelazi ostatak duga (${formatFening(outstandingFening)}).`);
      return;
    }

    setIsSaving(true);

    void (async () => {
      try {
        await createPayment(invoiceId, {
          amountFening,
          method,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        onSaved();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Naplata nije uspjela.');
        setIsSaving(false);
      }
    })();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.cardTitle}>Naplata</Text>
          <Text style={styles.metaSmall}>Ostatak duga: {formatFening(outstandingFening)}</Text>

          <Text style={styles.label}>Iznos (KM)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            testID="payment-amount"
          />

          <Text style={styles.label}>Način plaćanja</Text>
          <View style={styles.chips}>
            {PAYMENT_METHODS.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, method === option && styles.chipSelected]}
                onPress={() => setMethod(option)}
              >
                <Text style={[styles.chipText, method === option && styles.chipTextSelected]}>
                  {PAYMENT_METHOD_LABELS[option] ?? option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Napomena</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            maxLength={500}
            placeholder="Opciono"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
            testID="payment-save"
          >
            <Text style={styles.primaryButtonText}>{isSaving ? 'Čuvanje…' : 'Sačuvaj naplatu'}</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={onClose} disabled={isSaving}>
            <Text style={styles.linkButtonText}>Odustani</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface RefundModalProps {
  invoiceId: string;
  paidFening: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Refundacija (§7.7): novi REFUND dokument, iznos ≤ naplaćeno (kumulativno provjerava API). */
function RefundModal({ invoiceId, paidFening, onClose, onSaved }: RefundModalProps) {
  const [amount, setAmount] = useState(() => feningToPriceInput(paidFening));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleSubmit(): void {
    setError(null);
    const amountFening = parsePriceFening(amount);

    if (amountFening === null || amountFening < 1) {
      setError('Unesite ispravan iznos veći od 0.');
      return;
    }
    if (amountFening > paidFening) {
      setError(`Refundacija ne može biti veća od naplaćenog (${formatFening(paidFening)}).`);
      return;
    }

    setIsSaving(true);

    void (async () => {
      try {
        await refundInvoice(invoiceId, {
          amountFening,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        onSaved();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Refundacija nije uspjela.');
        setIsSaving(false);
      }
    })();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.cardTitle}>Refundacija</Text>
          <Text style={styles.metaSmall}>Naplaćeno: {formatFening(paidFening)}</Text>

          <Text style={styles.label}>Iznos (KM)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            testID="refund-amount"
          />

          <Text style={styles.label}>Napomena</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            maxLength={500}
            placeholder="Opciono"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
            testID="refund-save"
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Čuvanje…' : 'Sačuvaj refundaciju'}
            </Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={onClose} disabled={isSaving}>
            <Text style={styles.linkButtonText}>Odustani</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  centered: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  number: { color: '#1F2937', fontSize: 20, fontWeight: '700' },
  typeBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '700' },
  customer: { color: '#4B5563', fontSize: 14, marginTop: 6 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 12 },
  metaItem: { minWidth: 120 },
  metaLabel: { color: '#9CA3AF', fontSize: 11 },
  metaValue: { color: '#1F2937', fontSize: 14, marginTop: 2 },
  metaSmall: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  note: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
  },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  lineMain: { flex: 1, paddingRight: 8 },
  lineDescription: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  lineAmount: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  totals: { marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRowStrong: { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 4, paddingTop: 8 },
  totalLabel: { color: '#6B7280', fontSize: 14 },
  totalValue: { color: '#1F2937', fontSize: 14 },
  totalLabelStrong: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  totalValueStrong: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  pfr: { color: '#1F2937', fontSize: 12, marginTop: 2, marginBottom: 4 },
  hint: { color: '#9CA3AF', fontSize: 12, marginTop: 8 },
  warningCard: { backgroundColor: '#FFFBEB' },
  warningTitle: { color: '#92400E', fontSize: 15, fontWeight: '700' },
  warningText: { color: '#92400E', fontSize: 13, marginTop: 4 },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  paymentLabel: { color: '#1F2937', fontSize: 13, fontWeight: '600' },
  notice: {
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    fontSize: 13,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  successNotice: {
    backgroundColor: '#F0FDF4',
    color: '#166534',
    fontSize: 13,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  label: { color: '#6B7280', fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1F2937',
  },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 10, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerButtonText: { color: '#B91C1C', fontSize: 15, fontWeight: '600' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkButtonText: { color: '#6B7280', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { color: '#4B5563', fontSize: 13 },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
});
