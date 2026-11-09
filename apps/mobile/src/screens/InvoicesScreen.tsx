import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { listInvoices, type InvoiceSummaryDto } from '../api/invoices';
import { ApiError } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_FISCAL: 'Čeka fiskal.',
  ISSUED: 'Izdato',
  SENT: 'Poslato',
  PARTIALLY_PAID: 'Djelimično',
  PAID: 'Plaćeno',
  OVERDUE: 'Dospjelo',
  CANCELLED: 'Poništeno',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280',
  PENDING_FISCAL: '#B45309',
  ISSUED: '#1D4ED8',
  SENT: '#1D4ED8',
  PARTIALLY_PAID: '#B45309',
  PAID: '#16A34A',
  OVERDUE: '#B91C1C',
  CANCELLED: '#6B7280',
};

function formatFening(value: number): string {
  return `${(value / 100).toFixed(2)} KM`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

/** M-04 Fakture — lista sa statusima (§8). */
export function InvoicesScreen(_props: Props) {
  const [invoices, setInvoices] = useState<InvoiceSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      setError(null);

      listInvoices({ limit: 100 })
        .then((response) => {
          if (!active) return;
          setInvoices(response.items);
          setTotal(response.total);
        })
        .catch((caught) => {
          if (!active) return;
          setError(caught instanceof ApiError ? caught.message : 'Fakture nisu učitane.');
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1D4ED8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Nema faktura.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.number}>{item.number}</Text>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? '#1F2937' }]}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.customer}>{item.customer.name}</Text>
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>Rok: {formatDate(item.dueDate)}</Text>
              <Text style={styles.amount}>{formatFening(item.totalFening)}</Text>
            </View>
          </View>
        )}
      />
      <Text style={styles.total}>Ukupno: {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginTop: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '600' },
  customer: { color: '#4B5563', fontSize: 13, marginTop: 4 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meta: { color: '#9CA3AF', fontSize: 12 },
  amount: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
  error: { color: '#B91C1C', marginBottom: 8 },
  total: { color: '#6B7280', fontSize: 12, marginTop: 12 },
});
