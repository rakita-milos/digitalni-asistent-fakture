import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createCustomerSchema } from '@digitalni-asistent/shared';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { getDb } from '../db/localDb';
import { saveCustomer } from '../db/repos';
import { enqueueOperation, flushQueue } from '../sync/syncEngine';
import { uuidv7 } from '../utils/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerForm'>;

interface CustomerFormValues {
  name: string;
  phone: string;
  email: string;
  jib: string;
  city: string;
}

/**
 * Dodavanje kupca — offline-first: upis u lokalnu bazu + queue, pa push kad je mreža.
 * Iste Zod šeme kao API (§2).
 */
export function CustomerFormScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { control, handleSubmit } = useForm<CustomerFormValues>({
    defaultValues: { name: '', phone: '', email: '', jib: '', city: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    const payload = {
      name: values.name,
      ...(values.phone ? { phone: values.phone } : {}),
      ...(values.email ? { email: values.email } : {}),
      ...(values.jib ? { jib: values.jib } : {}),
      ...(values.city ? { city: values.city } : {}),
    };

    const parsed = createCustomerSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Neispravan unos');
      return;
    }

    setIsSaving(true);
    const entityId = uuidv7();

    try {
      const db = getDb();
      await saveCustomer(db, {
        id: entityId,
        name: parsed.data.name,
        jib: parsed.data.jib ?? null,
        vatId: parsed.data.vatId ?? null,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        note: parsed.data.note ?? null,
      });

      await enqueueOperation(db, {
        entity: 'customer',
        op: 'create',
        entityId,
        payload: parsed.data,
      });

      // Ako je mreža dostupna, odmah flush; u suprotnom operacija ostaje u queue-u.
      await flushQueue(db).catch(() => undefined);

      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kupac nije sačuvan.');
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Naziv *" name="name" control={control} testID="customer-name" />
        <Field label="Telefon (+387…)" name="phone" control={control} testID="customer-phone" />
        <Field label="Email" name="email" control={control} testID="customer-email" />
        <Field label="JIB (13 cifara)" name="jib" control={control} testID="customer-jib" />
        <Field label="Grad" name="city" control={control} testID="customer-city" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isSaving && styles.buttonDisabled]}
          onPress={() => {
            void onSubmit();
          }}
          disabled={isSaving}
          testID="customer-save"
        >
          <Text style={styles.buttonText}>{isSaving ? 'Čuvam…' : 'Sačuvaj kupca'}</Text>
        </Pressable>

        <Text style={styles.note}>
          Kupac se čuva lokalno i šalje na server kada je mreža dostupna.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  name: keyof CustomerFormValues;
  control: ReturnType<typeof useForm<CustomerFormValues>>['control'];
  testID: string;
}

function Field({ label, name, control, testID }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            style={styles.input}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize={name === 'email' ? 'none' : 'sentences'}
            testID={testID}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 8 },
  field: { marginBottom: 8 },
  label: { color: '#6B7280', fontSize: 13, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1F2937',
  },
  error: { color: '#B91C1C', marginTop: 8 },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
  note: { color: '#6B7280', fontSize: 12, marginTop: 12 },
});
