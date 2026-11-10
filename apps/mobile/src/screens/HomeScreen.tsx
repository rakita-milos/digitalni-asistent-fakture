import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { getReceivables, type ReceivablesReport } from '../api/reports';
import { ApiError } from '../api/client';
import { useAuthStore } from '../state/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const BUCKET_LABELS: Record<string, string> = {
  current: 'Nije dospjelo',
  '1-30': '1–30 dana',
  '31-60': '31–60 dana',
  '61-90': '61–90 dana',
  '90+': '90+ dana',
};

function formatFening(value: number): string {
  return `${(value / 100).toFixed(2)} KM`;
}

/** M-03 Početna — KPI potraživanja i aging (§8). */
export function HomeScreen({ navigation }: Props) {
  const company = useAuthStore((state) => state.company);
  const signOut = useAuthStore((state) => state.signOut);

  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      setError(null);

      getReceivables()
        .then((response) => {
          if (active) setReport(response);
        })
        .catch((caught) => {
          if (active) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : 'Podaci nisu učitani. Provjerite mrežu.',
            );
          }
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.company}>{company?.name ?? 'Firma'}</Text>
      <Text style={styles.caption}>Potraživanja</Text>

      <View style={styles.card}>
        <Text style={styles.kpiLabel}>Ukupno nenaplaćeno</Text>
        <Text style={styles.kpiValue}>
          {isLoading ? '…' : formatFening(report?.totalOutstandingFening ?? 0)}
        </Text>
        <Text style={styles.kpiMeta}>
          {report ? `${report.invoiceCount} faktura` : '—'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {(report?.buckets ?? []).map((bucket) => (
        <View key={bucket.key} style={styles.bucketRow}>
          <Text style={styles.bucketLabel}>{BUCKET_LABELS[bucket.key] ?? bucket.key}</Text>
          <Text style={styles.bucketValue}>
            {formatFening(bucket.amountFening)}
            {bucket.count > 0 ? ` (${bucket.count})` : ''}
          </Text>
        </View>
      ))}

      <Pressable
        style={styles.primary}
        onPress={() => navigation.navigate('InvoiceForm')}
        testID="home-new-invoice"
      >
        <Text style={styles.primaryText}>+ Nova faktura</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate('Invoices')}
        testID="home-invoices"
      >
        <Text style={styles.secondaryText}>Fakture</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate('Customers')}
        testID="home-customers"
      >
        <Text style={styles.secondaryText}>Kupci</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate('Settings')}
        testID="home-settings"
      >
        <Text style={styles.secondaryText}>Podešavanja</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={() => void signOut()} testID="logout">
        <Text style={styles.logoutText}>Odjavi se</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24 },
  company: { color: '#1D4ED8', fontSize: 22, fontWeight: '700' },
  caption: { color: '#6B7280', fontSize: 13, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  kpiLabel: { color: '#6B7280', fontSize: 13 },
  kpiValue: { color: '#1F2937', fontSize: 28, fontWeight: '700', marginTop: 4 },
  kpiMeta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  bucketLabel: { color: '#4B5563', fontSize: 14 },
  bucketValue: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  error: { color: '#B91C1C', marginTop: 12 },
  primary: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: { color: '#1D4ED8', fontWeight: '600' },
  logout: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#B91C1C', fontWeight: '600' },
});
