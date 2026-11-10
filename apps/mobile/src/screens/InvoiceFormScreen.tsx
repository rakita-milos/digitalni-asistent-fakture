import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CreateInvoiceInput } from '@digitalni-asistent/shared';
import { createInvoiceSchema } from '@digitalni-asistent/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../api/client';
import { getCompany } from '../api/company';
import { listItems, listTaxRates, type ItemDto, type TaxRateDto } from '../api/catalog';
import { listCustomers, type CustomerDto } from '../api/customers';
import { createInvoice, getInvoice, issueInvoice, updateInvoice } from '../api/invoices';
import { SelectModal } from '../components/SelectModal';
import { getDb } from '../db/localDb';
import { getMeta, listCustomers as listLocalCustomers, setMeta, upsertInvoices } from '../db/repos';
import {
  enqueueOperation,
  flushQueue,
  pullAndMerge,
} from '../sync/syncEngine';
import { formatFening, INVOICE_TYPE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '../utils/invoiceFormat';
import {
  addDaysInput,
  calculatePreviewLine,
  calculatePreviewTotals,
  feningToPriceInput,
  isValidDateInput,
  parsePercentBp,
  parsePriceFening,
  parseQtyMilli,
  qtyMilliToInput,
  taxRateBpToPercentInput,
  toApiDateTime,
  toDateInputValue,
  todayInput,
} from '../utils/invoiceMath';
import type { InvoicePreviewInput } from '../utils/invoiceMath';
import { buildLocalDraftInvoice } from '../utils/localInvoice';
import { uuidv7 } from '../utils/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceForm'>;
type Step = 'form' | 'review';
type InvoiceType = 'SALE' | 'ADVANCE';

interface EditorLine {
  key: string;
  description: string;
  qty: string;
  price: string;
  discountPercent: string;
  taxPercent: string;
}

type BuildResult = { ok: true; input: CreateInvoiceInput } | { ok: false; error: string };

function createLine(taxPercent: string): EditorLine {
  return {
    key: uuidv7(),
    description: '',
    qty: '1',
    price: '0.00',
    discountPercent: '0',
    taxPercent,
  };
}

/** Linija forme → ulaz za preview obračun (null dok unos nije validan). */
function toPreviewInput(line: EditorLine): InvoicePreviewInput | null {
  const qtyMilli = parseQtyMilli(line.qty);
  const unitPriceFening = parsePriceFening(line.price);
  const taxRateBp = parsePercentBp(line.taxPercent);
  const discountBp =
    line.discountPercent.trim() === '' ? 0 : parsePercentBp(line.discountPercent);

  if (qtyMilli === null || unitPriceFening === null || taxRateBp === null || discountBp === null) {
    return null;
  }

  return { qtyMilli, unitPriceFening, discountBp, taxRateBp };
}

/**
 * M-05 Nova faktura + M-06 pregled prije izdavanja.
 * Podaci se učitavaju online (offline fakture još nisu podržane — vidi PROGRESS).
 */
export function InvoiceFormScreen({ navigation, route }: Props) {
  const editingId = route.params?.invoiceId ?? null;
  const isEdit = editingId !== null;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [items, setItems] = useState<ItemDto[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateDto[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState<InvoiceType>('SALE');
  const [isOffline, setIsOffline] = useState(false);
  const [issueDate, setIssueDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState(addDaysInput(todayInput(), 15));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [lineItemPickerKey, setLineItemPickerKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      // Izmjena drafta: podaci se pune sa servera; offline fallback nije primjenjiv.
      if (isEdit && editingId) {
        try {
          const [invoice, customerList, itemList, taxRateList] = await Promise.all([
            getInvoice(editingId),
            listCustomers({ limit: 100 }),
            listItems(100),
            listTaxRates(),
          ]);

          if (!active) {
            return;
          }
          if (invoice.status !== 'DRAFT') {
            setLoadError('Samo draft faktura se može mijenjati.');
            setIsLoading(false);
            return;
          }

          setCustomers(customerList.items);
          setItems(itemList.items);
          setTaxRates(taxRateList.items);
          setCustomerId(invoice.customerId);
          setType(invoice.type === 'ADVANCE' ? 'ADVANCE' : 'SALE');
          setIssueDate(toDateInputValue(invoice.issueDate));
          setDueDate(toDateInputValue(invoice.dueDate));
          setPaymentMethod(invoice.paymentMethod ?? '');
          setNote(invoice.note ?? '');
          setLines(
            invoice.lines.map((line) => ({
              key: uuidv7(),
              description: line.description,
              qty: qtyMilliToInput(line.qtyMilli),
              price: feningToPriceInput(line.unitPriceFening),
              discountPercent: (line.discountBp / 100).toString(),
              taxPercent: taxRateBpToPercentInput(line.taxRateBp),
            })),
          );
          setIsOffline(false);
          setIsLoading(false);
          return;
        } catch (caught) {
          if (!active) {
            return;
          }
          setLoadError(
            caught instanceof ApiError
              ? caught.message
              : 'Faktura nije učitana. Provjerite mrežu.',
          );
          setIsLoading(false);
          return;
        }
      }

      try {
        const [customerList, itemList, taxRateList, company] = await Promise.all([
          listCustomers({ limit: 100 }),
          listItems(100),
          listTaxRates(),
          getCompany(),
        ]);

        if (!active) {
          return;
        }

        const activeTaxRate = taxRateList.items.find((rate) => rate.active) ?? taxRateList.items[0];
        const defaultTaxPercent = activeTaxRate
          ? taxRateBpToPercentInput(activeTaxRate.rateBp)
          : '17';

        setCustomers(customerList.items);
        setItems(itemList.items);
        setTaxRates(taxRateList.items);
        setCustomerId(customerList.items[0]?.id ?? '');
        setDueDate(addDaysInput(todayInput(), company.defaultDueDays));
        setLines([createLine(defaultTaxPercent)]);
        setIsOffline(false);
        setIsLoading(false);

        // Keširaj rok za offline formu (M-05 offline).
        void setMeta(getDb(), 'company_default_due_days', String(company.defaultDueDays)).catch(
          () => undefined,
        );
      } catch (caught) {
        if (!active) {
          return;
        }

        // Bez mreže: lokalni kupci iz SQLite, stavke se unose ručno (M-05 offline).
        try {
          const db = getDb();
          const localCustomers = await listLocalCustomers(db);
          const cachedDueDays = await getMeta(db, 'company_default_due_days');
          const parsedDueDays = Number.parseInt(cachedDueDays ?? '', 10);
          const dueDays = Number.isInteger(parsedDueDays) && parsedDueDays >= 0 ? parsedDueDays : 15;

          if (!active) {
            return;
          }

          setCustomers(
            localCustomers.map((customer) => ({
              id: customer.id,
              name: customer.name,
              jib: customer.jib,
              phone: customer.phone,
              email: customer.email,
              city: customer.city,
              address: customer.address,
              note: customer.note,
              archivedAt: customer.archivedAt,
            })),
          );
          setItems([]);
          setTaxRates([]);
          setCustomerId(localCustomers[0]?.id ?? '');
          setDueDate(addDaysInput(todayInput(), dueDays));
          setLines([createLine('17')]);
          setIsOffline(true);
          setIsLoading(false);
        } catch {
          if (!active) {
            return;
          }
          setLoadError(
            caught instanceof ApiError
              ? caught.message
              : 'Podaci nisu učitani. Provjerite mrežu.',
          );
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId, isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Izmjena drafta' : 'Nova faktura' });
  }, [isEdit, navigation]);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const taxRatesEmpty = taxRates.length === 0;

  const previewRows = useMemo(
    () =>
      lines.map((line) => {
        const input = toPreviewInput(line);
        return { key: line.key, input, totalFening: input ? calculatePreviewLine(input).totalFening : null };
      }),
    [lines],
  );

  const totals = useMemo(
    () =>
      calculatePreviewTotals(
        previewRows.flatMap((row) => (row.input ? [row.input] : [])),
      ),
    [previewRows],
  );

  function updateLine(key: string, patch: Partial<EditorLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleItemSelect(itemId: string): void {
    const item = items.find((candidate) => candidate.id === itemId);
    const lineKey = lineItemPickerKey;

    setLineItemPickerKey(null);

    if (!item || !lineKey) {
      return;
    }

    updateLine(lineKey, {
      description: item.name,
      price: feningToPriceInput(item.priceFening),
      taxPercent: taxRateBpToPercentInput(item.taxRateBp),
    });
  }

  function buildInvoiceInput(): BuildResult {
    if (!customerId) {
      return { ok: false, error: 'Izaberite kupca.' };
    }
    if (!isValidDateInput(issueDate) || !isValidDateInput(dueDate)) {
      return { ok: false, error: 'Datumi moraju biti u formatu GGGG-MM-DD.' };
    }

    const issueDateIso = toApiDateTime(issueDate);
    const dueDateIso = toApiDateTime(dueDate);

    if (new Date(dueDateIso).getTime() < new Date(issueDateIso).getTime()) {
      return { ok: false, error: 'Datum dospijeća ne može biti prije datuma izdavanja.' };
    }

    const payloadLines: CreateInvoiceInput['lines'] = [];

    for (const [index, line] of lines.entries()) {
      const position = index + 1;
      const qtyMilli = parseQtyMilli(line.qty);
      const unitPriceFening = parsePriceFening(line.price);
      const taxRateBp = parsePercentBp(line.taxPercent);
      const discountBp =
        line.discountPercent.trim() === '' ? 0 : parsePercentBp(line.discountPercent);

      if (line.description.trim() === '') {
        return { ok: false, error: `Stavka ${position}: opis je obavezan.` };
      }
      if (qtyMilli === null) {
        return { ok: false, error: `Stavka ${position}: količina mora biti veća od 0.` };
      }
      if (unitPriceFening === null) {
        return { ok: false, error: `Stavka ${position}: cijena nije ispravna.` };
      }
      if (taxRateBp === null) {
        return { ok: false, error: `Stavka ${position}: PDV stopa mora biti između 0 i 100 %.` };
      }
      if (discountBp === null) {
        return { ok: false, error: `Stavka ${position}: popust mora biti između 0 i 100 %.` };
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
      return { ok: false, error: 'Dodajte najmanje jednu stavku.' };
    }

    const candidate = {
      customerId,
      type,
      issueDate: issueDateIso,
      dueDate: dueDateIso,
      lines: payloadLines,
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    const parsed = createInvoiceSchema.safeParse(candidate);

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' };
    }

    return { ok: true, input: parsed.data };
  }

  function handleReview(): void {
    setError(null);
    const built = buildInvoiceInput();

    if (!built.ok) {
      setError(built.error);
      return;
    }

    setStep('review');
  }

  /** M-05 offline: draft u lokalnu SQLite + sync queue; server ga preuzima kad je mreža. */
  async function saveOffline(input: CreateInvoiceInput): Promise<void> {
    try {
      const db = getDb();
      const entityId = uuidv7();
      const localTotals = calculatePreviewTotals(
        input.lines.map((line) => ({
          qtyMilli: line.qtyMilli,
          unitPriceFening: line.unitPriceFening,
          taxRateBp: line.taxRateBp,
          discountBp: line.discountBp,
        })),
      );

      await upsertInvoices(db, [
        buildLocalDraftInvoice({
          id: entityId,
          customerId: input.customerId,
          customerName: selectedCustomer?.name ?? 'Kupac',
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          totalFening: localTotals.totalFening,
          updatedAt: new Date().toISOString(),
        }),
      ]);
      await enqueueOperation(db, {
        entity: 'invoice',
        op: 'create',
        entityId,
        payload: input,
      });
      await flushQueue(db).catch(() => undefined);
      await pullAndMerge(db).catch(() => undefined);

      setIsSaving(false);
      Alert.alert(
        'Sačuvano offline',
        'Faktura je sačuvana lokalno i biće poslana na server kada je mreža dostupna. Izdavanje je moguće nakon sinhronizacije.',
        [{ text: 'U redu', onPress: () => navigation.goBack() }],
      );
    } catch {
      setError('Faktura nije sačuvana lokalno. Provjerite prostor na uređaju.');
      setIsSaving(false);
    }
  }

  function handleSubmit(issueImmediately: boolean): void {
    setError(null);
    const built = buildInvoiceInput();

    if (!built.ok) {
      setError(built.error);
      setStep('form');
      return;
    }

    setIsSaving(true);

    void (async () => {
      if (isEdit && editingId) {
        try {
          await updateInvoice(editingId, built.input);
          navigation.replace('InvoiceDetail', {
            invoiceId: editingId,
            notice: 'Izmjene na draftu su sačuvane.',
          });
        } catch (caught) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'Izmjene nisu sačuvane. Provjerite mrežu.',
          );
          setIsSaving(false);
        }
        return;
      }

      if (isOffline) {
        await saveOffline(built.input);
        return;
      }

      let createdId: string | null = null;

      try {
        const created = await createInvoice(built.input);
        createdId = created.id;

        if (issueImmediately && type === 'SALE') {
          await issueInvoice(created.id);
        }

        navigation.replace('InvoiceDetail', { invoiceId: created.id });
      } catch (caught) {
        // Mreža je pala u toku zahtjeva — sačuvaj fakturu lokalno (M-05 offline).
        if (!(caught instanceof ApiError)) {
          await saveOffline(built.input);
          return;
        }

        const message = caught.message;

        if (createdId) {
          navigation.replace('InvoiceDetail', {
            invoiceId: createdId,
            notice: `Faktura je sačuvana, ali fiskalizacija nije uspjela: ${message}`,
          });
          return;
        }

        setError(message);
        setIsSaving(false);
      }
    })();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  if (customers.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Nema kupaca</Text>
        <Text style={styles.emptyText}>
          Prvo dodajte kupca, pa se vratite na izradu fakture.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CustomerForm')}
          testID="invoice-empty-add-customer"
        >
          <Text style={styles.primaryButtonText}>+ Novi kupac</Text>
        </Pressable>
      </View>
    );
  }

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    label: customer.name,
    subtitle: [customer.city, customer.phone].filter(Boolean).join(' · ') || undefined,
  }));
  const itemOptions = items.map((item) => ({
    id: item.id,
    label: item.name,
    subtitle: `${formatFening(item.priceFening)} / ${item.unit}`,
  }));

  if (step === 'review') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>
          {isEdit ? 'Pregled izmjena' : 'Pregled prije izdavanja'}
        </Text>
        <Text style={styles.screenHint}>
          {isOffline
            ? 'Offline režim — faktura se čuva lokalno i šalje kada je mreža dostupna.'
            : type === 'ADVANCE'
              ? 'PRAČUN se ne fiskalizuje.'
              : 'Provjerite podatke prije izdavanja.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedCustomer?.name ?? '—'}</Text>
          <Text style={styles.meta}>
            {INVOICE_TYPE_LABELS[type] ?? type} · {issueDate} → {dueDate}
          </Text>
          {paymentMethod ? (
            <Text style={styles.meta}>Plaćanje: {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}</Text>
          ) : null}
          {note.trim() ? <Text style={styles.meta}>Napomena: {note.trim()}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stavke</Text>
          {lines.map((line, index) => {
            const input = toPreviewInput(line);
            const total = input ? calculatePreviewLine(input).totalFening : null;
            return (
              <View key={line.key} style={styles.reviewRow}>
                <View style={styles.reviewRowMain}>
                  <Text style={styles.reviewDescription}>
                    {index + 1}. {line.description.trim() || '(bez opisa)'}
                  </Text>
                  <Text style={styles.meta}>
                    {line.qty} × {line.price} KM · PDV {line.taxPercent} %
                  </Text>
                </View>
                <Text style={styles.reviewAmount}>{formatFening(total ?? 0)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Osnovica</Text>
            <Text style={styles.totalValue}>{formatFening(totals.subtotalFening)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>PDV</Text>
            <Text style={styles.totalValue}>{formatFening(totals.taxFening)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowStrong]}>
            <Text style={styles.totalLabelStrong}>Ukupno</Text>
            <Text style={styles.totalValueStrong}>{formatFening(totals.totalFening)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {type === 'SALE' && !isOffline && !isEdit ? (
          <Pressable
            style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
            onPress={() => handleSubmit(true)}
            disabled={isSaving}
            testID="invoice-issue"
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Izdavanje…' : 'Izdaj i fiskalizuj'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.secondaryButton, isSaving && styles.buttonDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={isSaving}
          testID="invoice-save-draft"
        >
          <Text style={styles.secondaryButtonText}>
            {isSaving
              ? 'Čuvanje…'
              : isEdit
                ? 'Sačuvaj izmjene'
                : isOffline
                  ? 'Sačuvaj offline'
                  : type === 'ADVANCE'
                    ? 'Sačuvaj PRAČUN'
                    : 'Sačuvaj kao draft'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => setStep('form')}
          disabled={isSaving}
          testID="invoice-review-back"
        >
          <Text style={styles.linkButtonText}>Nazad na izmjenu</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {isOffline ? (
        <Text style={styles.offlineBanner}>
          Offline — faktura se čuva lokalno i šalje na server kada je mreža dostupna. Izdavanje
          (fiskalizacija) zahtijeva mrežu.
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Podaci o fakturi</Text>

        <Text style={styles.label}>Kupac</Text>
        <Pressable
          style={styles.select}
          onPress={() => setCustomerPickerVisible(true)}
          testID="invoice-customer"
        >
          <Text style={selectedCustomer ? styles.selectValue : styles.selectPlaceholder}>
            {selectedCustomer?.name ?? 'Izaberite kupca'}
          </Text>
        </Pressable>

        <Text style={styles.label}>Tip dokumenta</Text>
        <View style={styles.chips}>
          {(['SALE', 'ADVANCE'] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, type === option && styles.chipSelected]}
              onPress={() => setType(option)}
              testID={`invoice-type-${option.toLowerCase()}`}
            >
              <Text style={[styles.chipText, type === option && styles.chipTextSelected]}>
                {INVOICE_TYPE_LABELS[option] ?? option}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Datum izdavanja</Text>
            <TextInput
              style={styles.input}
              value={issueDate}
              onChangeText={setIssueDate}
              placeholder="GGGG-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              testID="invoice-issue-date"
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Rok plaćanja</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="GGGG-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              testID="invoice-due-date"
            />
          </View>
        </View>

        <Text style={styles.label}>Način plaćanja</Text>
        <View style={styles.chips}>
          <Pressable
            style={[styles.chip, paymentMethod === '' && styles.chipSelected]}
            onPress={() => setPaymentMethod('')}
          >
            <Text style={[styles.chipText, paymentMethod === '' && styles.chipTextSelected]}>
              —
            </Text>
          </Pressable>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method}
              style={[styles.chip, paymentMethod === method && styles.chipSelected]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={[styles.chipText, paymentMethod === method && styles.chipTextSelected]}>
                {PAYMENT_METHOD_LABELS[method] ?? method}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Napomena</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Opciono"
          multiline
          maxLength={2000}
          testID="invoice-note"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Stavke</Text>
          <Pressable
            style={styles.addLineButton}
            onPress={() => {
              const firstRate = taxRates.find((rate) => rate.active) ?? taxRates[0];
              setLines((current) => [
                ...current,
                createLine(firstRate ? taxRateBpToPercentInput(firstRate.rateBp) : '17'),
              ]);
            }}
            testID="invoice-add-line"
          >
            <Text style={styles.addLineText}>+ Stavka</Text>
          </Pressable>
        </View>

        {isOffline && items.length === 0 ? (
          <Text style={styles.meta}>
            Katalog artikala nije dostupan offline — unesite opis i cijenu ručno.
          </Text>
        ) : null}

        {lines.map((line, index) => {
          const preview = toPreviewInput(line);
          const lineTotal = preview ? calculatePreviewLine(preview).totalFening : null;

          return (
            <View key={line.key} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineTitle}>Stavka {index + 1}</Text>
                {lines.length > 1 ? (
                  <Pressable
                    onPress={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    testID={`invoice-remove-line-${index}`}
                  >
                    <Text style={styles.removeText}>Ukloni</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Artikal</Text>
                  <Pressable
                    style={styles.select}
                    onPress={() => setLineItemPickerKey(line.key)}
                    testID={`invoice-line-item-${index}`}
                  >
                    <Text style={styles.selectPlaceholder}>Izaberi iz kataloga</Text>
                  </Pressable>
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Opis</Text>
                  <TextInput
                    style={styles.input}
                    value={line.description}
                    onChangeText={(value) => updateLine(line.key, { description: value })}
                    maxLength={500}
                    testID={`invoice-line-description-${index}`}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Količina</Text>
                  <TextInput
                    style={styles.input}
                    value={line.qty}
                    onChangeText={(value) => updateLine(line.key, { qty: value })}
                    keyboardType="decimal-pad"
                    testID={`invoice-line-qty-${index}`}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Cijena (KM)</Text>
                  <TextInput
                    style={styles.input}
                    value={line.price}
                    onChangeText={(value) => updateLine(line.key, { price: value })}
                    keyboardType="decimal-pad"
                    testID={`invoice-line-price-${index}`}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Popust %</Text>
                  <TextInput
                    style={styles.input}
                    value={line.discountPercent}
                    onChangeText={(value) => updateLine(line.key, { discountPercent: value })}
                    keyboardType="decimal-pad"
                    testID={`invoice-line-discount-${index}`}
                  />
                </View>
              </View>

              <Text style={styles.label}>PDV stopa</Text>
              {taxRatesEmpty ? (
                <TextInput
                  style={styles.input}
                  value={line.taxPercent}
                  onChangeText={(value) => updateLine(line.key, { taxPercent: value })}
                  keyboardType="decimal-pad"
                  testID={`invoice-line-tax-${index}`}
                />
              ) : (
                <View style={styles.chips}>
                  {taxRates.map((rate) => {
                    const percent = taxRateBpToPercentInput(rate.rateBp);
                    const selected = line.taxPercent === percent;

                    return (
                      <Pressable
                        key={rate.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => updateLine(line.key, { taxPercent: percent })}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {rate.name} ({percent} %)
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={styles.lineTotal}>Iznos: {formatFening(lineTotal ?? 0)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Osnovica</Text>
          <Text style={styles.totalValue}>{formatFening(totals.subtotalFening)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>PDV</Text>
          <Text style={styles.totalValue}>{formatFening(totals.taxFening)}</Text>
        </View>
        <View style={[styles.totalRow, styles.totalRowStrong]}>
          <Text style={styles.totalLabelStrong}>Ukupno</Text>
          <Text style={styles.totalValueStrong}>{formatFening(totals.totalFening)}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primaryButton} onPress={handleReview} testID="invoice-review">
        <Text style={styles.primaryButtonText}>Pregled</Text>
      </Pressable>

      <SelectModal
        visible={customerPickerVisible}
        title="Izaberite kupca"
        options={customerOptions}
        onSelect={(id) => {
          setCustomerId(id);
          setCustomerPickerVisible(false);
        }}
        onClose={() => setCustomerPickerVisible(false)}
        searchPlaceholder="Traži kupca…"
      />

      <SelectModal
        visible={lineItemPickerKey !== null}
        title="Izaberite artikal"
        options={itemOptions}
        onSelect={handleItemSelect}
        onClose={() => setLineItemPickerKey(null)}
        searchPlaceholder="Traži artikal…"
        emptyLabel="Katalog je prazan — opis i cijenu možete unijeti ručno."
      />
    </ScrollView>
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
  screenTitle: { color: '#1F2937', fontSize: 20, fontWeight: '700' },
  screenHint: { color: '#6B7280', fontSize: 13, marginBottom: 4 },
  offlineBanner: {
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    fontSize: 13,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  emptyTitle: { color: '#1F2937', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700', marginBottom: 4 },
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
  noteInput: { minHeight: 64, textAlignVertical: 'top' },
  select: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  selectValue: { color: '#1F2937' },
  selectPlaceholder: { color: '#9CA3AF' },
  row: { flexDirection: 'row', gap: 8 },
  rowItem: { flex: 1 },
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
  lineCard: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTitle: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  removeText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  lineTotal: { color: '#6B7280', fontSize: 13, textAlign: 'right', marginTop: 8 },
  addLineButton: { padding: 4 },
  addLineText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowStrong: { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 4, paddingTop: 8 },
  totalLabel: { color: '#6B7280', fontSize: 14 },
  totalValue: { color: '#1F2937', fontSize: 14 },
  totalLabelStrong: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  totalValueStrong: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  reviewRowMain: { flex: 1, paddingRight: 8 },
  reviewDescription: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  reviewAmount: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  meta: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkButtonText: { color: '#6B7280', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
});
