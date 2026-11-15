import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
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

import { emailSchema, phoneSchema } from '@digitalni-asistent/shared';

import { changePassword, updateProfile } from '../api/auth';
import { ApiError } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../state/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlasnik',
  worker: 'Zaposleni',
  accountant: 'Računovođa',
  agency: 'Agencija',
};

/**
 * M-12 — nalog: profil (telefon, e-mail) i promjena lozinke, bez odlaska na web.
 * Promjena e-maila traži trenutnu lozinku jer je e-mail identitet za prijavu i reset.
 */
export function AccountScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const applyUser = useAuthStore((state) => state.applyUser);
  const disableBiometricLogin = useAuthStore((state) => state.disableBiometricLogin);
  const biometricEnrolled = useAuthStore((state) => state.biometricEnrolled);

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  async function handleSaveProfile(): Promise<void> {
    setProfileError(null);
    setProfileMessage(null);

    const parsedPhone = phoneSchema.safeParse(phone.trim());
    if (!parsedPhone.success) {
      setProfileError('Telefon mora biti u formatu +387XXXXXXXX.');
      return;
    }

    const parsedEmail = emailSchema.safeParse(email.trim());
    if (!parsedEmail.success) {
      setProfileError('E-mail nije ispravan.');
      return;
    }

    const emailChanged = parsedEmail.data !== (user?.email ?? '');
    if (emailChanged && !emailPassword) {
      setProfileError('Za promjenu e-maila unesite trenutnu lozinku.');
      return;
    }

    setIsSavingProfile(true);

    try {
      const result = await updateProfile({
        phone: parsedPhone.data,
        ...(emailChanged ? { email: parsedEmail.data, currentPassword: emailPassword } : {}),
      });

      await applyUser(result.user);
      setProfileMessage('Podaci naloga su sačuvani.');
      setEmailPassword('');
    } catch (caught) {
      setProfileError(
        caught instanceof ApiError ? caught.message : 'Čuvanje nije uspjelo. Provjerite mrežu.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    setPasswordError(null);
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordError('Unesite trenutnu lozinku.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Nova lozinka mora imati najmanje 8 znakova.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Nove lozinke se ne poklapaju.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('Nova lozinka mora biti različita od trenutne.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Upamćena lozinka za biometrijsku prijavu više nije važeća.
      if (biometricEnrolled) {
        await disableBiometricLogin();
      }

      setPasswordMessage(
        biometricEnrolled
          ? 'Lozinka je promijenjena. Biometrijska prijava je isključena — uključite je pri sljedećoj prijavi.'
          : 'Lozinka je promijenjena.',
      );
    } catch (caught) {
      setPasswordError(
        caught instanceof ApiError ? caught.message : 'Promjena lozinke nije uspjela.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uloga</Text>
            <Text style={styles.infoValue}>
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'}
            </Text>
          </View>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            testID="account-email"
          />

          <Text style={styles.label}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            keyboardType="phone-pad"
            placeholder="+387XXXXXXXX"
            testID="account-phone"
          />

          {email !== (user?.email ?? '') ? (
            <>
              <Text style={styles.label}>Trenutna lozinka (za promjenu e-maila)</Text>
              <TextInput
                style={styles.input}
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
                autoCapitalize="none"
                testID="account-email-password"
              />
              <Text style={styles.hint}>
                E-mail je identitet za prijavu i reset lozinke, zato tražimo potvrdu.
              </Text>
            </>
          ) : null}

          {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
          {profileMessage ? <Text style={styles.success}>{profileMessage}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSavingProfile && styles.buttonDisabled]}
            onPress={() => void handleSaveProfile()}
            disabled={isSavingProfile}
            testID="account-save-profile"
          >
            {isSavingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sačuvaj profil</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Promjena lozinke</Text>

          <Text style={styles.label}>Trenutna lozinka</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            testID="account-current-password"
          />

          <Text style={styles.label}>Nova lozinka</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            testID="account-new-password"
          />
          <Text style={styles.hint}>Najmanje 8 znakova.</Text>

          <Text style={styles.label}>Ponovi novu lozinku</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            testID="account-confirm-password"
          />

          {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
          {passwordMessage ? <Text style={styles.success}>{passwordMessage}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isChangingPassword && styles.buttonDisabled]}
            onPress={() => void handleChangePassword()}
            disabled={isChangingPassword}
            testID="account-change-password"
          >
            {isChangingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Promijeni lozinku</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Ostali uređaji će biti odjavljeni; ovaj uređaj ostaje prijavljen.
          </Text>
        </View>

        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>Nazad na podešavanja</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8 },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { color: '#6B7280', fontSize: 13 },
  infoValue: { color: '#1F2937', fontSize: 13, fontWeight: '600' },
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
  hint: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 10 },
  success: { color: '#166534', fontSize: 13, marginTop: 10 },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkButtonText: { color: '#6B7280', fontSize: 14 },
});
