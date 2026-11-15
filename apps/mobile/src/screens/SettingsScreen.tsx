import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../api/client';
import { getSubscription, type SubscriptionDto } from '../api/subscriptions';
import { useAuthStore } from '../state/authStore';
import { formatDate } from '../utils/invoiceFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const PLAN_LABELS: Record<string, string> = {
  trial: 'Probni period',
  standard: 'Standard',
  premium: 'Premium',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktivna',
  trial: 'Probni period',
  past_due: 'Dospjelo',
  cancelled: 'Otkazana',
  inactive: 'Neaktivna',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlasnik',
  worker: 'Zaposleni',
  accountant: 'Računovođa',
  agency: 'Agencija',
};

/**
 * M-12 Podešavanja — sve sekcije na jednom mjestu:
 * firma/EFD/porezi/numeracija (M-02 wizard), podsjetnici (M-10), pretplata, nalog i odjava.
 */
export function SettingsScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const signOut = useAuthStore((state) => state.signOut);
  const biometricAvailable = useAuthStore((state) => state.biometricAvailable);
  const biometricEnrolled = useAuthStore((state) => state.biometricEnrolled);
  const disableBiometricLogin = useAuthStore((state) => state.disableBiometricLogin);

  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    setIsLoadingSubscription(true);
    setSubscriptionMessage(null);

    try {
      const response = await getSubscription();
      setSubscription(response.subscription);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setSubscriptionMessage('Pretplatu može vidjeti samo vlasnik firme.');
      } else {
        setSubscriptionMessage(
          caught instanceof ApiError
            ? caught.message
            : 'Pretplata nije učitana. Provjerite mrežu.',
        );
      }
    } finally {
      setIsLoadingSubscription(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
      return undefined;
    }, [loadSubscription]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Firma</Text>
        <Text style={styles.companyName}>{company?.name ?? 'Firma'}</Text>

        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Setup')}
          testID="settings-company"
        >
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Podaci firme, EFD, porezi i numeracija</Text>
            <Text style={styles.rowHint}>Postavljanje i izmjena (M-02)</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Reminders')}
          testID="settings-reminders"
        >
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Podsjetnici</Text>
            <Text style={styles.rowHint}>Plan, šablon i ručno slanje (M-10)</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pretplata</Text>

        {isLoadingSubscription ? (
          <ActivityIndicator color="#1D4ED8" style={styles.loader} />
        ) : subscriptionMessage ? (
          <Text style={styles.muted}>{subscriptionMessage}</Text>
        ) : subscription ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Plan</Text>
              <Text style={styles.infoValue}>
                {PLAN_LABELS[subscription.plan] ?? subscription.plan}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </Text>
            </View>
            {subscription.trialEndsAt ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Probni period do</Text>
                <Text style={styles.infoValue}>{formatDate(subscription.trialEndsAt)}</Text>
              </View>
            ) : null}
            {subscription.currentPeriodEnd ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Period do</Text>
                <Text style={styles.infoValue}>{formatDate(subscription.currentPeriodEnd)}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>Pretplata još nije evidentirana.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nalog</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Telefon</Text>
          <Text style={styles.infoValue}>{user?.phone ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Uloga</Text>
          <Text style={styles.infoValue}>
            {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'}
          </Text>
        </View>

        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Account')}
          testID="settings-account"
        >
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Nalog i lozinka</Text>
            <Text style={styles.rowHint}>Izmjena profila i promjena lozinke (M-12)</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {biometricAvailable ? (
          <View style={styles.biometricRow}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>Prijava biometrijom</Text>
              <Text style={styles.rowHint}>
                {biometricEnrolled
                  ? 'Uključena — aplikacija traži biometriju pri pokretanju.'
                  : 'Uključite je pri prijavi (opcija „Zapamti prijavu biometrijom“).'}
              </Text>
            </View>
            {biometricEnrolled ? (
              <Pressable
                style={styles.biometricDisable}
                onPress={() => void disableBiometricLogin()}
                testID="settings-biometric-disable"
              >
                <Text style={styles.biometricDisableText}>Isključi</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable style={styles.logout} onPress={() => void signOut()} testID="settings-logout">
          <Text style={styles.logoutText}>Odjavi se</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>Digitalni Asistent · MVP 0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8 },
  cardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  companyName: { color: '#6B7280', fontSize: 13, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: 12,
    gap: 8,
  },
  rowMain: { flex: 1 },
  rowTitle: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  rowHint: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  chevron: { color: '#9CA3AF', fontSize: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  infoLabel: { color: '#6B7280', fontSize: 13 },
  infoValue: { color: '#1F2937', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  loader: { marginVertical: 8 },
  muted: { color: '#6B7280', fontSize: 13 },
  logout: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: { color: '#B91C1C', fontSize: 14, fontWeight: '600' },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: 12,
  },
  biometricDisable: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  biometricDisableText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  version: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
