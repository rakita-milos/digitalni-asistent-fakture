import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { loginSchema } from '@digitalni-asistent/shared';

import { useAuthStore } from '../state/authStore';

interface LoginForm {
  identifier: string;
  password: string;
}

/**
 * M-01 Prijava (§8): email/telefon + lozinka, uz opcionu biometrijsku prijavu.
 * Forma koristi React Hook Form + Zod šemu iz `@digitalni-asistent/shared` (§2).
 * Upamćena prijava je vezana za biometriju uređaja (Keychain, vidi `biometricSession.ts`).
 */
export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithBiometrics = useAuthStore((state) => state.signInWithBiometrics);
  const enableBiometricLogin = useAuthStore((state) => state.enableBiometricLogin);
  const biometricAvailable = useAuthStore((state) => state.biometricAvailable);
  const biometricEnrolled = useAuthStore((state) => state.biometricEnrolled);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const storeError = useAuthStore((state) => state.error);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rememberBiometrics, setRememberBiometrics] = useState(false);

  const { control, handleSubmit } = useForm<LoginForm>({
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Neispravan unos';
      setLocalError(message);
      return;
    }

    setLocalError(null);
    const success = await signIn(parsed.data.identifier, parsed.data.password);

    // Upamti prijavu samo poslije uspješne prijave (i ako je korisnik tražio).
    if (success && rememberBiometrics && biometricAvailable) {
      await enableBiometricLogin(parsed.data.identifier, parsed.data.password);
    }
  });

  const error = localError ?? storeError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Digitalni Asistent</Text>
        <Text style={styles.subtitle}>Prijava</Text>

        <Text style={styles.label}>Email ili telefon</Text>
        <Controller
          control={control}
          name="identifier"
          render={({ field }) => (
            <TextInput
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="vlasnik@firma.ba"
              testID="login-identifier"
            />
          )}
        />

        <Text style={styles.label}>Lozinka</Text>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextInput
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              placeholder="••••••••"
              testID="login-password"
            />
          )}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {biometricAvailable && biometricEnrolled ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => void signInWithBiometrics()}
            disabled={isSubmitting}
            testID="login-biometric"
          >
            <Text style={styles.secondaryButtonText}>Prijavi se biometrijom</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => {
            void onSubmit();
          }}
          disabled={isSubmitting}
          testID="login-submit"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Prijavi se</Text>
          )}
        </Pressable>

        {biometricAvailable ? (
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setRememberBiometrics((current) => !current)}
            disabled={isSubmitting}
            testID="login-remember-biometrics"
          >
            <View style={[styles.checkbox, rememberBiometrics && styles.checkboxChecked]}>
              {rememberBiometrics ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>Zapamti prijavu biometrijom</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, gap: 8 },
  title: { color: '#1D4ED8', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#1F2937', fontSize: 16, marginBottom: 16 },
  label: { color: '#6B7280', fontSize: 13, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1F2937',
  },
  error: { color: '#B91C1C', marginTop: 12 },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  checkboxLabel: { color: '#4B5563', fontSize: 13 },
});
