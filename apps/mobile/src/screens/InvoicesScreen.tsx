import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { getDb } from '../db/localDb';
import { listInvoices as listLocalInvoices, type LocalInvoice } from '../db/repos';
import { flushQueue, pullAndMerge, queueSummary, retryFailed } from '../sync/syncEngine';
import { queueAlarmMessage, type QueueAlarm } from '../sync/retry';
import { formatDate, formatFening, STATUS_COLORS, STATUS_LABELS } from '../utils/invoiceFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;

/**
 * M-04 Fakture — offline-first: lista se čita iz lokalne SQLite baze,
 * pull/flush se puštaju u pozadini (kao M-11 kupci). Lokalno kreirane fakture
 * (M-05 offline) vidljive su odmah, sa oznakom dok ne odu na server.
 */
export function InvoicesScreen({ navigation }: Props) {
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);
  const [queue, setQueue] = useState<QueueAlarm>({ pending: 0, due: 0, failed: 0, stale: 0 });
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    try {
      const db = getDb();
      setInvoices(await listLocalInvoices(db));
      setQueue(await queueSummary(db));
    } catch {
      // Ako lokalna baza nije dostupna, prikaz ostaje prazna lista.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      const db = getDb();
      await pullAndMerge(db);
      await flushQueue(db);
      setIsOffline(false);
      await loadLocal();
    } catch {
      setIsOffline(true);
    }
  }, [loadLocal]);

  const retrySync = useCallback(async () => {
    setIsRetrying(true);
    try {
      const db = getDb();
      await retryFailed(db);
      await flushQueue(db);
      setIsOffline(false);
      await loadLocal();
    } catch {
      setIsOffline(true);
    } finally {
      setIsRetrying(false);
    }
  }, [loadLocal]);

  useFocusEffect(
    useCallback(() => {
      void loadLocal();
      void sync();
      return undefined;
    }, [loadLocal, sync]),
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
      {isOffline ? <Text style={styles.offline}>Offline — prikaz lokalnih faktura</Text> : null}
      {queueAlarmMessage(queue) !== null ? (
        <Text style={queue.stale > 0 ? styles.alarm : styles.pending} testID="invoices-queue-alarm">
          {queueAlarmMessage(queue)}
        </Text>
      ) : null}
      {queue.failed > 0 ? (
        <Pressable onPress={retrySync} disabled={isRetrying} testID="invoices-retry-sync">
          <Text style={styles.retryText}>{isRetrying ? 'Šaljem…' : 'Pokušaj ponovo slanje'}</Text>
        </Pressable>
      ) : null}

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
                {item.number.startsWith('DRAFT-') ? ' · nije poslano' : ''}
              </Text>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? '#1F2937' }]}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.customer}>{item.customerName ?? '—'}</Text>
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>Rok: {formatDate(item.dueDate)}</Text>
              <Text style={styles.amount}>{formatFening(item.totalFening)}</Text>
            </View>
          </Pressable>
        )}
      />

      <Text style={styles.total}>Ukupno: {invoices.length}</Text>

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
  offline: { color: '#B45309', fontSize: 12, marginBottom: 4 },
  pending: { color: '#B45309', fontSize: 12, marginBottom: 4 },
  alarm: { color: '#B91C1C', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  retryText: { color: '#1D4ED8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginTop: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  number: { color: '#1F2937', fontSize: 15, fontWeight: '700', flex: 1 },
  status: { fontSize: 12, fontWeight: '600' },
  customer: { color: '#4B5563', fontSize: 13, marginTop: 4 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meta: { color: '#9CA3AF', fontSize: 12 },
  amount: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
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
