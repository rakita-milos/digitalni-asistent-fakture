import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps } from 'react-native';

import { DEFAULT_REMINDER_TEMPLATE } from '@digitalni-asistent/shared';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { ApiError } from '../../api/client';
import { getCompany, updateCompany, type CompanyDto } from '../../api/company';
import { createTaxRate, listTaxRates, type TaxRateDto } from '../../api/catalog';
import { getReminderSettings, updateReminderSettings } from '../../api/reminders';
import { getDb } from '../../db/localDb';
import { getMeta, setMeta } from '../../db/repos';
import {
  MAX_REMINDER_ITEMS,
  SETUP_COMPLETED_KEY,
  SETUP_PROGRESS_KEY,
  SETUP_STEP_TITLES,
  buildReminderSettingsInput,
  buildSetupStepInput,
  buildTaxRateInput,
  clampSetupStep,
  formatNumberPreview,
  formatRateBp,
  parseIntegerInRange,
  parseSetupProgress,
  setupStepHint,
  setupStepLabel,
  setupStepTitle,
} from './helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'Setup'>;

const REMINDER_FORBIDDEN_MESSAGE = 'Podešavanja podsjetnika može mijenjati samo vlasnik firme';
const ESIR_MOCK_NOTE =
  'ESIR (e-fiskalizacija) je u mock režimu dok operater ne odgovori (G0). Ovaj korak samo evidentira EFD ID firme — fiskalizacija se trenutno ne izvršava.';

function toErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    // 401/403 se ne prikazuju kao sirova serverska poruka — korisniku je jasnije šta da radi.
    if (caught.status === 401) {
      return 'Sesija je istekla. Prijavite se ponovo.';
    }
    if (caught.status === 403) {
      return 'Nemate dozvolu za ovu izmjenu.';
    }
    return caught.message;
  }
  return fallback;
}

async function readSavedProgress(): Promise<string | null> {
  try {
    return await getMeta(getDb(), SETUP_PROGRESS_KEY);
  } catch {
    // Lokalna baza nije dostupna — setup počinje od prvog koraka.
    return null;
  }
}

async function writeSetupProgress(step: number): Promise<void> {
  try {
    await setMeta(getDb(), SETUP_PROGRESS_KEY, String(step));
  } catch {
    // Nepostojanje lokalne baze ne smije blokirati sam wizard.
  }
}

/**
 * M-02 Setup wizard (5 koraka): firma, EFD, porezi, numeracija, podsjetnici.
 * Napredak se čuva u lokalnoj SQLite `meta` tabeli (`setup_progress`) pa se setup
 * može prekinuti i nastaviti. Ruta se registruje u RootNavigator-u (izvan ovog foldera).
 */
export function SetupScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Korak 1 — firma
  const [jib, setJib] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Korak 2 — EFD
  const [efdId, setEfdId] = useState('');

  // Korak 3 — porezi
  const [taxRates, setTaxRates] = useState<TaxRateDto[]>([]);
  const [taxRatesLoading, setTaxRatesLoading] = useState(false);
  const [taxRatesError, setTaxRatesError] = useState<string | null>(null);
  const [taxRatesReload, setTaxRatesReload] = useState(0);
  const [taxName, setTaxName] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [taxSufCode, setTaxSufCode] = useState('');
  const [isAddingTaxRate, setIsAddingTaxRate] = useState(false);
  const [taxRateNotice, setTaxRateNotice] = useState<string | null>(null);

  // Korak 4 — numeracija
  const [numberingPrefix, setNumberingPrefix] = useState('');
  const [numberingYear, setNumberingYear] = useState('');
  const [numberingNext, setNumberingNext] = useState('');
  const [defaultDueDays, setDefaultDueDays] = useState('');

  // Korak 5 — podsjetnici
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderLoaded, setReminderLoaded] = useState(false);
  const [reminderForbidden, setReminderForbidden] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderReload, setReminderReload] = useState(0);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTemplate, setReminderTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [reminderOffsets, setReminderOffsets] = useState<string[]>([]);

  const prefillFromCompany = useCallback((loaded: CompanyDto) => {
    setJib(loaded.jib);
    setName(loaded.name);
    setAddress(loaded.address);
    setCity(loaded.city);
    setPhone(loaded.phone);
    setEmail(loaded.email);
    setEfdId(loaded.efdId ?? '');
    setNumberingPrefix(loaded.numberingPrefix);
    setNumberingYear(String(loaded.numberingYear));
    setNumberingNext(String(loaded.numberingNext));
    setDefaultDueDays(String(loaded.defaultDueDays));
  }, []);

  // Učitavanje profila firme + napretka setup-a (nastavak od sačuvanog koraka).
  useEffect(() => {
    let active = true;

    void (async () => {
      const savedProgress = await readSavedProgress();
      let alreadyCompleted = false;

      try {
        alreadyCompleted = (await getMeta(getDb(), SETUP_COMPLETED_KEY)) === '1';
      } catch {
        // Bez lokalne baze tretiramo setup kao nezavršen.
        alreadyCompleted = false;
      }

      try {
        const loaded = await getCompany();
        if (!active) {
          return;
        }
        prefillFromCompany(loaded);
        // Završen setup se pri ponovnom ulasku ponaša kao podešavanja: kreće od prvog koraka.
        setStep(alreadyCompleted ? 0 : parseSetupProgress(savedProgress));
      } catch (caught) {
        if (!active) {
          return;
        }
        setLoadError(
          toErrorMessage(caught, 'Podaci firme nisu učitani. Provjerite mrežu.'),
        );
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [prefillFromCompany]);

  // Porezne stope se učitavaju kad korisnik uđe u korak „Porezi“.
  useEffect(() => {
    if (step !== 2) {
      return;
    }

    let active = true;

    void (async () => {
      setTaxRatesLoading(true);
      setTaxRatesError(null);

      try {
        const response = await listTaxRates();
        if (!active) {
          return;
        }
        setTaxRates(response.items);
      } catch (caught) {
        if (!active) {
          return;
        }
        setTaxRatesError(
          toErrorMessage(caught, 'Porezne stope nisu učitane. Provjerite mrežu.'),
        );
      } finally {
        if (active) {
          setTaxRatesLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [step, taxRatesReload]);

  // Podešavanja podsjetnika su owner-only; 403 se obrađuje posebno (samo informacija).
  useEffect(() => {
    if (step !== 4) {
      return;
    }

    let active = true;

    void (async () => {
      setReminderLoading(true);
      setReminderError(null);
      setReminderForbidden(false);
      setReminderLoaded(false);

      try {
        const settings = await getReminderSettings();
        if (!active) {
          return;
        }
        setReminderEnabled(settings.enabled);
        setReminderTemplate(settings.template.text);
        setReminderOffsets(
          settings.schedule
            .slice(0, MAX_REMINDER_ITEMS)
            .map((item) => String(item.offsetDays)),
        );
        setReminderLoaded(true);
      } catch (caught) {
        if (!active) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 403) {
          setReminderForbidden(true);
        } else if (caught instanceof ApiError && caught.status === 401) {
          setReminderError('Sesija je istekla. Prijavite se ponovo.');
        } else {
          setReminderError(
            toErrorMessage(caught, 'Podešavanja podsjetnika nisu učitana. Provjerite mrežu.'),
          );
        }
      } finally {
        if (active) {
          setReminderLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [step, reminderReload]);

  function goToStep(nextStep: number): void {
    const clamped = clampSetupStep(nextStep);
    setError(null);
    setStep(clamped);
    void writeSetupProgress(clamped);
  }

  async function completeSetup(): Promise<void> {
    try {
      await setMeta(getDb(), SETUP_COMPLETED_KEY, '1');
    } catch {
      // I bez upisa u lokalnu bazu setup se zatvara — korisnik ne smije ostati zaglavljen.
    }
    navigation.goBack();
  }

  function handleSaveAndContinue(): void {
    setError(null);

    const built = buildSetupStepInput(step, {
      company: { name, address, city, phone, email },
      efdId,
      numbering: { numberingPrefix, numberingYear, numberingNext, defaultDueDays },
    });

    if (!built) {
      return;
    }
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setIsSaving(true);
    void (async () => {
      try {
        await updateCompany(built.input);
        goToStep(step + 1);
      } catch (caught) {
        setError(toErrorMessage(caught, 'Izmjene nisu sačuvane. Provjerite mrežu.'));
      } finally {
        setIsSaving(false);
      }
    })();
  }

  function handleAddTaxRate(): void {
    setError(null);
    setTaxRateNotice(null);

    const built = buildTaxRateInput({ name: taxName, percent: taxPercent, sufCode: taxSufCode });
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setIsAddingTaxRate(true);
    void (async () => {
      try {
        await createTaxRate(built.input);
        setTaxName('');
        setTaxPercent('');
        setTaxSufCode('');
        setTaxRateNotice('Stopa je dodata.');
        setTaxRatesReload((current) => current + 1);
      } catch (caught) {
        setError(toErrorMessage(caught, 'Stopa nije dodata. Provjerite mrežu.'));
      } finally {
        setIsAddingTaxRate(false);
      }
    })();
  }

  function handleFinish(): void {
    setError(null);

    const built = buildReminderSettingsInput({
      enabled: reminderEnabled,
      templateText: reminderTemplate,
      offsets: reminderOffsets,
    });

    if (!built.ok) {
      setError(built.error);
      return;
    }

    setIsSaving(true);
    void (async () => {
      try {
        await updateReminderSettings(built.input);
        await completeSetup();
      } catch (caught) {
        setError(
          toErrorMessage(caught, 'Podešavanja podsjetnika nisu sačuvana. Provjerite mrežu.'),
        );
      } finally {
        setIsSaving(false);
      }
    })();
  }

  function handlePrimaryPress(): void {
    if (step === 4) {
      if (reminderForbidden) {
        void completeSetup();
        return;
      }
      if (reminderError !== null && !reminderLoaded) {
        setReminderReload((current) => current + 1);
        return;
      }
      handleFinish();
      return;
    }

    if (step === 2) {
      goToStep(3);
      return;
    }

    handleSaveAndContinue();
  }

  function handleSkip(): void {
    if (step === 4) {
      void completeSetup();
      return;
    }
    goToStep(step + 1);
  }

  function handleBack(): void {
    if (step === 0) {
      return;
    }
    goToStep(step - 1);
  }

  function handleRetryLoad(): void {
    setBootstrapping(true);
    setLoadError(null);

    void (async () => {
      try {
        const loaded = await getCompany();
        prefillFromCompany(loaded);
      } catch (caught) {
        setLoadError(toErrorMessage(caught, 'Podaci firme nisu učitani. Provjerite mrežu.'));
      } finally {
        setBootstrapping(false);
      }
    })();
  }

  function updateReminderOffset(index: number, value: string): void {
    setReminderOffsets((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function addReminderOffset(): void {
    setReminderOffsets((current) =>
      current.length >= MAX_REMINDER_ITEMS ? current : [...current, '0'],
    );
  }

  function removeReminderOffset(index: number): void {
    setReminderOffsets((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function primaryButtonLabel(): string {
    if (step === 2) {
      return 'Dalje';
    }
    if (step === 4) {
      if (reminderLoading || (!reminderLoaded && !reminderForbidden && reminderError === null)) {
        return 'Učitavanje…';
      }
      if (reminderError !== null && !reminderLoaded) {
        return 'Pokušaj ponovo';
      }
      if (isSaving) {
        return 'Čuvam…';
      }
      return reminderForbidden ? 'Završi' : 'Završi setup';
    }
    return isSaving ? 'Čuvam…' : 'Sačuvaj i nastavi';
  }

  function renderCompanyStep() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Podaci o firmi</Text>

        <Field label="Naziv firme *" value={name} onChangeText={setName} testID="setup-company-name" />
        <Field
          label="Adresa *"
          value={address}
          onChangeText={setAddress}
          testID="setup-company-address"
        />
        <Field label="Grad *" value={city} onChangeText={setCity} testID="setup-company-city" />
        <Field
          label="Telefon (+387XXXXXXXX) *"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          testID="setup-company-phone"
        />
        <Field
          label="Email *"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="setup-company-email"
        />
        <Field
          label="JIB (ne mijenja se)"
          value={jib === '' ? '—' : jib}
          editable={false}
          testID="setup-company-jib"
        />

        <Text style={styles.note}>
          JIB je jedinstveni identifikator firme — mijenja se isključivo kroz podršku.
        </Text>
      </View>
    );
  }

  function renderEfdStep() {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EFD ID</Text>
          <Field
            label="EFD ID (opciono)"
            value={efdId}
            onChangeText={setEfdId}
            autoCapitalize="none"
            maxLength={100}
            placeholder="npr. EFD-123456"
            testID="setup-efd-id"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{ESIR_MOCK_NOTE}</Text>
        </View>
      </>
    );
  }

  function renderTaxesStep() {
    return (
      <>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Postojeće stope</Text>
            <Pressable
              onPress={() => setTaxRatesReload((current) => current + 1)}
              testID="setup-tax-refresh"
            >
              <Text style={styles.addLineText}>Osvježi</Text>
            </Pressable>
          </View>

          {taxRatesLoading ? (
            <ActivityIndicator color="#1D4ED8" style={styles.inlineLoader} />
          ) : null}

          {taxRatesError !== null ? <Text style={styles.error}>{taxRatesError}</Text> : null}

          {!taxRatesLoading && taxRatesError === null && taxRates.length === 0 ? (
            <Text style={styles.note}>
              Još nema poreznih stopa — preporučeno je dodati bar jednu (npr. PDV 17 %).
            </Text>
          ) : null}

          {taxRates.map((rate) => (
            <View key={rate.id} style={styles.rateRow}>
              <View style={styles.rateMain}>
                <Text style={styles.rateName}>{rate.name}</Text>
                <Text style={styles.rateMeta}>
                  SUF {rate.sufCode}
                  {rate.active ? '' : ' · neaktivna'}
                </Text>
              </View>
              <Text style={styles.rateValue}>{formatRateBp(rate.rateBp)} %</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nova stopa</Text>

          <Field
            label="Naziv *"
            value={taxName}
            onChangeText={setTaxName}
            placeholder="npr. PDV 17 %"
            maxLength={50}
            testID="setup-tax-name"
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Field
                label="Procenat *"
                value={taxPercent}
                onChangeText={setTaxPercent}
                placeholder="npr. 17 ili 17,5"
                keyboardType="decimal-pad"
                testID="setup-tax-percent"
              />
            </View>
            <View style={styles.rowItem}>
              <Field
                label="SUF kod *"
                value={taxSufCode}
                onChangeText={setTaxSufCode}
                placeholder="npr. 17"
                autoCapitalize="characters"
                maxLength={20}
                testID="setup-tax-suf"
              />
            </View>
          </View>

          {taxRateNotice !== null ? <Text style={styles.success}>{taxRateNotice}</Text> : null}

          <Pressable
            style={[styles.secondaryButton, isAddingTaxRate && styles.buttonDisabled]}
            onPress={handleAddTaxRate}
            disabled={isAddingTaxRate}
            testID="setup-tax-add"
          >
            <Text style={styles.secondaryButtonText}>
              {isAddingTaxRate ? 'Dodajem…' : '+ Dodaj stopu'}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderNumberingStep() {
    const year = parseIntegerInRange(numberingYear, 2020, 2100);
    const next = parseIntegerInRange(numberingNext, 1, Number.MAX_SAFE_INTEGER);
    const preview =
      year !== null && next !== null
        ? formatNumberPreview(numberingPrefix.trim(), year, next)
        : null;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Numeracija faktura</Text>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Prefiks"
              value={numberingPrefix}
              onChangeText={setNumberingPrefix}
              placeholder="npr. FV"
              maxLength={20}
              testID="setup-numbering-prefix"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Godina *"
              value={numberingYear}
              onChangeText={setNumberingYear}
              keyboardType="number-pad"
              testID="setup-numbering-year"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Sljedeći broj *"
              value={numberingNext}
              onChangeText={setNumberingNext}
              keyboardType="number-pad"
              testID="setup-numbering-next"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Rok plaćanja (dana) *"
              value={defaultDueDays}
              onChangeText={setDefaultDueDays}
              keyboardType="number-pad"
              testID="setup-due-days"
            />
          </View>
        </View>

        {preview !== null ? (
          <Text style={styles.preview} testID="setup-numbering-preview">
            Primjer broja: {preview}
          </Text>
        ) : null}

        <Text style={styles.note}>
          Broj se sastoji od prefiksa, godine i rednog broja (npr. FV2026-0001). Godina mora
          biti između 2020 i 2100, a rok plaćanja između 0 i 365 dana.
        </Text>
      </View>
    );
  }

  function renderReminderForm() {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Automatski podsjetnici</Text>

          <Text style={styles.label}>Slanje</Text>
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, reminderEnabled && styles.chipSelected]}
              onPress={() => setReminderEnabled(true)}
              testID="setup-reminder-enabled"
            >
              <Text style={[styles.chipText, reminderEnabled && styles.chipTextSelected]}>
                Uključeni
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, !reminderEnabled && styles.chipSelected]}
              onPress={() => setReminderEnabled(false)}
              testID="setup-reminder-disabled"
            >
              <Text style={[styles.chipText, !reminderEnabled && styles.chipTextSelected]}>
                Isključeni
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Šablon poruke *</Text>
          <TextInput
            style={[styles.input, styles.templateInput]}
            value={reminderTemplate}
            onChangeText={setReminderTemplate}
            multiline
            maxLength={500}
            testID="setup-reminder-template"
          />
          <Text style={styles.note}>
            {'Šablon mora sadržavati {broj} i {iznos} (10–500 znakova).'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Plan (do 4)</Text>
            <Pressable
              onPress={addReminderOffset}
              disabled={reminderOffsets.length >= MAX_REMINDER_ITEMS}
              testID="setup-reminder-add"
            >
              <Text
                style={[
                  styles.addLineText,
                  reminderOffsets.length >= MAX_REMINDER_ITEMS && styles.footerLinkDisabled,
                ]}
              >
                + Dodaj
              </Text>
            </Pressable>
          </View>

          {reminderOffsets.length === 0 ? (
            <Text style={styles.note}>Nema planiranih podsjetnika.</Text>
          ) : null}

          {reminderOffsets.map((offset, index) => (
            <View key={`reminder-offset-${index}`} style={styles.reminderRow}>
              <View style={styles.reminderInputWrap}>
                <Field
                  label="Pomak u danima (-30 do 30)"
                  value={offset}
                  onChangeText={(value) => updateReminderOffset(index, value)}
                  keyboardType="numbers-and-punctuation"
                  testID={`setup-reminder-offset-${index}`}
                />
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => removeReminderOffset(index)}
                testID={`setup-reminder-remove-${index}`}
              >
                <Text style={styles.removeText}>Ukloni</Text>
              </Pressable>
            </View>
          ))}

          <Text style={styles.note}>
            Negativan pomak znači podsjetnik prije roka, pozitivan poslije roka. Šalje se SMS-om.
          </Text>
        </View>
      </>
    );
  }

  function renderRemindersStep() {
    // Dok se status ne razriješi (prije nego efekt pokrene učitavanje) prikazujemo loader.
    if (
      reminderLoading ||
      (!reminderLoaded && !reminderForbidden && reminderError === null)
    ) {
      return (
        <View style={styles.card}>
          <ActivityIndicator color="#1D4ED8" />
          <Text style={styles.note}>Učitavanje podešavanja podsjetnika…</Text>
        </View>
      );
    }

    if (reminderForbidden) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Podsjetnici</Text>
          <Text style={styles.error} testID="setup-reminder-forbidden">
            {REMINDER_FORBIDDEN_MESSAGE}
          </Text>
          <Text style={styles.note}>
            Setup možete završiti; podešavanja kasnije može izmijeniti vlasnik firme.
          </Text>
        </View>
      );
    }

    if (reminderError !== null && !reminderLoaded) {
      return (
        <View style={styles.card}>
          <Text style={styles.error}>{reminderError}</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setReminderReload((current) => current + 1)}
            testID="setup-reminder-retry"
          >
            <Text style={styles.secondaryButtonText}>Pokušaj ponovo</Text>
          </Pressable>
        </View>
      );
    }

    return renderReminderForm();
  }

  if (bootstrapping) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (loadError !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
        <Pressable style={styles.primaryButton} onPress={handleRetryLoad} testID="setup-retry-load">
          <Text style={styles.primaryButtonText}>Pokušaj ponovo</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()} testID="setup-close">
          <Text style={styles.linkButtonText}>Zatvori</Text>
        </Pressable>
      </View>
    );
  }

  const reminderPending =
    step === 4 && !reminderLoading && !reminderLoaded && !reminderForbidden && reminderError === null;
  const primaryDisabled =
    isSaving || isAddingTaxRate || (step === 4 && (reminderLoading || reminderPending));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.progressLabel} testID="setup-step-label">
            {setupStepLabel(step)}
          </Text>
          <Text style={styles.title}>{setupStepTitle(step)}</Text>
          <Text style={styles.hint}>{setupStepHint(step)}</Text>
        </View>

        <View style={styles.stepsRow}>
          {SETUP_STEP_TITLES.map((title, index) => (
            <View key={title} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  index < step && styles.stepDotDone,
                  index === step && styles.stepDotCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    index < step && styles.stepDotTextDone,
                    index === step && styles.stepDotTextCurrent,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[styles.stepCaption, index === step && styles.stepCaptionCurrent]}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          ))}
        </View>

        {step === 0 ? renderCompanyStep() : null}
        {step === 1 ? renderEfdStep() : null}
        {step === 2 ? renderTaxesStep() : null}
        {step === 3 ? renderNumberingStep() : null}
        {step === 4 ? renderRemindersStep() : null}

        {error !== null ? (
          <Text style={styles.error} testID="setup-error">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, primaryDisabled && styles.buttonDisabled]}
          onPress={handlePrimaryPress}
          disabled={primaryDisabled}
          testID="setup-primary"
        >
          <Text style={styles.primaryButtonText}>{primaryButtonLabel()}</Text>
        </Pressable>

        <View style={styles.footerRow}>
          <Pressable
            onPress={handleBack}
            disabled={step === 0 || isSaving}
            testID="setup-back"
          >
            <Text
              style={[
                styles.footerLink,
                (step === 0 || isSaving) && styles.footerLinkDisabled,
              ]}
            >
              ‹ Nazad
            </Text>
          </Pressable>

          <Pressable onPress={handleSkip} disabled={isSaving} testID="setup-skip">
            <Text style={styles.footerLink}>
              {step === 4 ? 'Preskoči i završi' : 'Preskoči ›'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Napredak se automatski čuva — setup možete prekinuti i nastaviti kasnije.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  testID?: string;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
  maxLength,
  testID,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, editable === false && styles.inputReadOnly]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        multiline={multiline}
        maxLength={maxLength}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  centered: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  header: { gap: 4 },
  progressLabel: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  title: { color: '#1F2937', fontSize: 22, fontWeight: '700' },
  hint: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
  stepsRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  stepDotDone: { backgroundColor: '#16A34A' },
  stepDotCurrent: { backgroundColor: '#1D4ED8' },
  stepDotText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  stepDotTextDone: { color: '#FFFFFF' },
  stepDotTextCurrent: { color: '#FFFFFF' },
  stepCaption: { color: '#9CA3AF', fontSize: 10 },
  stepCaptionCurrent: { color: '#1D4ED8', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  label: { color: '#6B7280', fontSize: 12, marginTop: 10, marginBottom: 4 },
  field: { marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1F2937',
  },
  inputReadOnly: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  row: { flexDirection: 'row', gap: 8 },
  rowItem: { flex: 1 },
  note: { color: '#6B7280', fontSize: 12, lineHeight: 17, marginTop: 10 },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  infoText: { color: '#1E3A8A', fontSize: 13, lineHeight: 19 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8, textAlign: 'center' },
  success: { color: '#16A34A', fontSize: 13, marginTop: 8 },
  preview: { color: '#1F2937', fontSize: 14, fontWeight: '600', marginTop: 12 },
  inlineLoader: { marginVertical: 8 },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
  },
  rateMain: { flex: 1 },
  rateName: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  rateMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  rateValue: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
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
  templateInput: { minHeight: 88, textAlignVertical: 'top' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  reminderInputWrap: { flex: 1 },
  removeButton: { paddingBottom: 10 },
  removeText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  addLineText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  linkButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  linkButtonText: { color: '#6B7280', fontSize: 14 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  footerLink: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  footerLinkDisabled: { color: '#9CA3AF' },
  footerNote: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
