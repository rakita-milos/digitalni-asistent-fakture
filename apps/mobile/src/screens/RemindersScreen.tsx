import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DEFAULT_REMINDER_TEMPLATE, MAX_AUTOMATIC_REMINDERS } from '@digitalni-asistent/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../api/client';
import { listInvoices, type InvoiceSummaryDto } from '../api/invoices';
import {
  getReminderSettings,
  listReminders,
  sendInvoiceReminder,
  updateReminderSettings,
  type ReminderDto,
} from '../api/reminders';
import { SelectModal } from '../components/SelectModal';
import { formatDate, formatFening } from '../utils/invoiceFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

/** Statusi u kojima faktura može dobiti podsjetnik (§7.9). */
const REMINDABLE_STATUSES = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Zakazano', color: '#B45309' },
  SENT: { label: 'Poslano', color: '#16A34A' },
  FAILED: { label: 'Neuspjelo', color: '#B91C1C' },
  CANCELLED: { label: 'Otkazano', color: '#6B7280' },
};

/**
 * M-10 Podsjetnici — plan i šablon (§7.9), lista poslanih/zakazanih i „pošalji odmah“.
 * Podešavanja su owner-only; zaposleni vide samo listu i mogu poslati ručni podsjetnik.
 */
export function RemindersScreen(_props: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [offsets, setOffsets] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [reminders, setReminders] = useState<ReminderDto[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [remindersError, setRemindersError] = useState<string | null>(null);

  const [payableInvoices, setPayableInvoices] = useState<InvoiceSummaryDto[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);

    try {
      const response = await listReminders(50);
      setReminders(response.items);
    } catch (caught) {
      setRemindersError(
        caught instanceof ApiError ? caught.message : 'Podsjetnici nisu učitani. Provjerite mrežu.',
      );
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  const loadPayableInvoices = useCallback(async () => {
    try {
      const response = await listInvoices({ limit: 100 });
      setPayableInvoices(
        response.items.filter((invoice) => REMINDABLE_STATUSES.includes(invoice.status)),
      );
    } catch {
      // Bez liste faktura „pošalji odmah“ je i dalje dostupan preko detalja fakture (M-08).
      setPayableInvoices([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setIsLoading(true);
      setLoadError(null);
      setForbidden(false);

      void (async () => {
        try {
          const settings = await getReminderSettings();
          if (!active) {
            return;
          }
          setEnabled(settings.enabled);
          setTemplate(settings.template.text);
          setOffsets(
            settings.schedule
              .slice(0, MAX_AUTOMATIC_REMINDERS)
              .map((item) => String(item.offsetDays)),
          );
        } catch (caught) {
          if (!active) {
            return;
          }
          if (caught instanceof ApiError && caught.status === 403) {
            setForbidden(true);
          } else {
            setLoadError(
              caught instanceof ApiError
                ? caught.message
                : 'Podešavanja podsjetnika nisu učitana. Provjerite mrežu.',
            );
          }
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      })();

      void loadReminders();
      void loadPayableInvoices();

      return () => {
        active = false;
      };
    }, [loadReminders, loadPayableInvoices]),
  );

  function handleSaveSettings(): void {
    setSettingsError(null);
    setSettingsSuccess(null);

    const text = template.trim();

    if (text.length < 10 || text.length > 500) {
      setSettingsError('Šablon mora imati između 10 i 500 znakova.');
      return;
    }
    if (!text.includes('{broj}') || !text.includes('{iznos}')) {
      setSettingsError('Šablon mora sadržavati {broj} i {iznos}.');
      return;
    }
    if (offsets.length > MAX_AUTOMATIC_REMINDERS) {
      setSettingsError(`Plan može imati najviše ${MAX_AUTOMATIC_REMINDERS} stavke.`);
      return;
    }

    const schedule: Array<{ offsetDays: number; kind: string }> = [];

    for (const raw of offsets) {
      if (raw.trim() === '') {
        continue;
      }

      const offsetDays = Number(raw.trim().replace(',', '.'));

      if (!Number.isInteger(offsetDays) || offsetDays < -30 || offsetDays > 30) {
        setSettingsError('Pomak dana mora biti cijeli broj između -30 i 30.');
        return;
      }

      schedule.push({ offsetDays, kind: 'sms' });
    }

    setIsSaving(true);

    void (async () => {
      try {
        await updateReminderSettings({ enabled, schedule, template: { text } });
        setSettingsSuccess('Podešavanja podsjetnika su sačuvana.');
      } catch (caught) {
        setSettingsError(
          caught instanceof ApiError
            ? caught.message
            : 'Podešavanja nisu sačuvana. Provjerite mrežu.',
        );
      } finally {
        setIsSaving(false);
      }
    })();
  }

  function handleSendNow(invoiceId: string): void {
    setPickerVisible(false);
    setSendError(null);
    setSendSuccess(null);
    setIsSending(true);

    void (async () => {
      try {
        await sendInvoiceReminder(invoiceId);
        setSendSuccess('Podsjetnik je poslan kupcu.');
        await loadReminders();
      } catch (caught) {
        setSendError(
          caught instanceof ApiError ? caught.message : 'Podsjetnik nije poslan. Provjerite mrežu.',
        );
      } finally {
        setIsSending(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan i šablon</Text>

        {forbidden ? (
          <Text style={styles.muted}>
            Podešavanja podsjetnika može mijenjati samo vlasnik firme. Lista i slanje su dostupni.
          </Text>
        ) : loadError ? (
          <Text style={styles.error}>{loadError}</Text>
        ) : (
          <>
            <Pressable
              style={styles.toggleRow}
              onPress={() => setEnabled((current) => !current)}
              testID="reminders-enabled"
            >
              <View style={[styles.checkbox, enabled && styles.checkboxChecked]}>
                {enabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.toggleLabel}>Automatski podsjetnici uključeni</Text>
            </Pressable>

            <Text style={styles.label}>Šablon poruke</Text>
            <TextInput
              style={[styles.input, styles.templateInput]}
              value={template}
              onChangeText={setTemplate}
              multiline
              maxLength={500}
              testID="reminders-template"
            />
            <Text style={styles.hint}>Placeholderi: {'{broj}'}, {'{iznos}'}, {'{rok}'}, {'{firma}'}</Text>

            <Text style={styles.label}>Plan (dani u odnosu na rok)</Text>
            {offsets.map((offset, index) => (
              <View key={`offset-${index}`} style={styles.offsetRow}>
                <TextInput
                  style={[styles.input, styles.offsetInput]}
                  value={offset}
                  onChangeText={(value) =>
                    setOffsets((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
                    )
                  }
                  keyboardType="number-pad"
                  placeholder="npr. 3"
                  testID={`reminders-offset-${index}`}
                />
                <Pressable
                  onPress={() =>
                    setOffsets((current) => current.filter((_item, i) => i !== index))
                  }
                  testID={`reminders-remove-offset-${index}`}
                >
                  <Text style={styles.removeText}>Ukloni</Text>
                </Pressable>
              </View>
            ))}

            {offsets.length < MAX_AUTOMATIC_REMINDERS ? (
              <Pressable
                style={styles.addButton}
                onPress={() => setOffsets((current) => [...current, ''])}
                testID="reminders-add-offset"
              >
                <Text style={styles.addButtonText}>+ Dodaj stavku plana</Text>
              </Pressable>
            ) : null}

            {settingsError ? <Text style={styles.error}>{settingsError}</Text> : null}
            {settingsSuccess ? <Text style={styles.success}>{settingsSuccess}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={handleSaveSettings}
              disabled={isSaving}
              testID="reminders-save"
            >
              <Text style={styles.primaryButtonText}>
                {isSaving ? 'Čuvanje…' : 'Sačuvaj plan'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Podsjetnici</Text>

        {remindersLoading ? (
          <ActivityIndicator color="#1D4ED8" />
        ) : remindersError ? (
          <Text style={styles.error}>{remindersError}</Text>
        ) : reminders.length === 0 ? (
          <Text style={styles.muted}>Još nema podsjetnika.</Text>
        ) : (
          reminders.map((reminder) => {
            const status = STATUS_LABELS[reminder.status] ?? {
              label: reminder.status,
              color: '#1F2937',
            };

            return (
              <View key={reminder.id} style={styles.reminderRow}>
                <View style={styles.reminderMain}>
                  <Text style={styles.reminderNumber}>{reminder.invoiceNumber}</Text>
                  <Text style={styles.meta}>
                    {reminder.sentAt
                      ? `Poslano ${formatDate(reminder.sentAt)}`
                      : `Zakazano ${formatDate(reminder.scheduledAt)}`}
                    {' · '}
                    {reminder.kind === 'manual' ? 'Ručni' : 'Automatski'}
                  </Text>
                  {reminder.error ? <Text style={styles.error}>{reminder.error}</Text> : null}
                </View>
                <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pošalji odmah</Text>
        <Text style={styles.muted}>
          Ručni SMS podsjetnik za fakturu sa otvorenim dugom. Poruka koristi sačuvani šablon.
        </Text>

        {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
        {sendSuccess ? <Text style={styles.success}>{sendSuccess}</Text> : null}

        {payableInvoices.length === 0 ? (
          <Text style={styles.muted}>Nema faktura sa otvorenim dugom.</Text>
        ) : (
          <Pressable
            style={[styles.primaryButton, isSending && styles.buttonDisabled]}
            onPress={() => setPickerVisible(true)}
            disabled={isSending}
            testID="reminders-send"
          >
            <Text style={styles.primaryButtonText}>
              {isSending ? 'Slanje…' : 'Izaberi fakturu i pošalji'}
            </Text>
          </Pressable>
        )}
      </View>

      <SelectModal
        visible={pickerVisible}
        title="Pošalji podsjetnik za fakturu"
        options={payableInvoices.map((invoice) => ({
          id: invoice.id,
          label: `${invoice.number} · ${invoice.customer.name}`,
          subtitle: `Ostatak: ${formatFening(invoice.totalFening - invoice.paidFening)}`,
        }))}
        onSelect={handleSendNow}
        onClose={() => setPickerVisible(false)}
        searchPlaceholder="Traži po broju ili kupcu…"
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
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8 },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { color: '#6B7280', fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1F2937',
  },
  templateInput: { minHeight: 84, textAlignVertical: 'top' },
  hint: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  toggleLabel: { color: '#1F2937', fontSize: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  offsetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  offsetInput: { width: 96 },
  removeText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  addButton: { paddingVertical: 10 },
  addButtonText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  muted: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8 },
  success: { color: '#166534', fontSize: 13, marginTop: 8 },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
    gap: 8,
  },
  reminderMain: { flex: 1 },
  reminderNumber: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  meta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700' },
});
