import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { listInvoices, type InvoiceSummaryDto } from '../api/invoices';
import { ApiError } from '../api/client';
import {
  formatDate,
  formatFening,
  INVOICE_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../utils/invoiceFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;

/** M-04 Fakture — lista sa statusima (§8). */
export function InvoicesScreen({ navigation }: Props) {
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
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
            testID={`invoice-row-${item.id}`}
          >
            <View style={styles.rowTop}>
              <Text style={styles.number}>
                {item.number}
                {item.type === 'ADVANCE'
                  ? ` · ${INVOICE_TYPE_LABELS['ADVANCE'] ?? 'PRAČUN'}`
                  : ''}
              </Text>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? '#1F2937' }]}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.customer}>{item.customer.name}</Text>
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>Rok: {formatDate(item.dueDate)}</Text>
              <Text style={styles.amount}>{formatFening(item.totalFening)}</Text>
            </View>
          </Pressable>
        )}
      />

      <Text style={styles.total}>Ukupno: {total}</Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate('InvoiceForm')}
        testID="invoices-new"
      >
        <Text style={styles.primaryButtonText}>+ Nova faktura</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginTop: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  number: { color: '#1F2937', fontSize: 15, fontWeight: '700', flex: 1 },
  status: { fontSize: 12, fontWeight: '600' },
  customer: { color: '#4B5563', fontSize: 13, marginTop: 4 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meta: { color: '#9CA3AF', fontSize: 12 },
  amount: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
  error: { color: '#B91C1C', marginBottom: 8 },
  total: { color: '#6B7280', fontSize: 12, marginTop: 12 },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
});
