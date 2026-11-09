import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { getDb } from '../db/localDb';
import { listCustomers, type LocalCustomer } from '../db/repos';
import { flushQueue, pullAndMerge } from '../sync/syncEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'Customers'>;

/**
 * M-11 Kupci — offline-first: lista se čita iz lokalne SQLite baze,
 * a pull/flush se puštaju u pozadini (bez blokiranja UI-ja).
 */
export function CustomersScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const loadLocal = useCallback(async (search: string) => {
    const db = getDb();
    const rows = await listCustomers(db, search);
    setCustomers(rows);
    setIsLoading(false);
  }, []);

  const sync = useCallback(
    async (search: string) => {
      try {
        const db = getDb();
        await pullAndMerge(db);
        await flushQueue(db);
        setIsOffline(false);
        await loadLocal(search);
      } catch {
        // Bez mreže se nastavlja sa lokalnim podacima (§4: sve osim fiskalizacije radi offline).
        setIsOffline(true);
      }
    },
    [loadLocal],
  );

  useFocusEffect(
    useCallback(() => {
      void loadLocal(query);
      void sync(query);
      return undefined;
    }, [loadLocal, sync, query]),
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          void loadLocal(value);
        }}
        placeholder="Traži po imenu, JIB-u, telefonu…"
        autoCapitalize="none"
        testID="customers-search"
      />

      {isOffline ? <Text style={styles.offline}>Offline — prikaz lokalnih podataka</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#1D4ED8" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Nema kupaca.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {[item.city, item.phone].filter(Boolean).join(' · ') || 'Bez kontakta'}
              </Text>
            </View>
          )}
        />
      )}

      <Text style={styles.total}>Ukupno: {customers.length}</Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('CustomerForm')}
        testID="customers-add"
      >
        <Text style={styles.buttonText}>+ Novi kupac</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  search: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1F2937',
  },
  loader: { marginTop: 24 },
  offline: { color: '#B45309', fontSize: 12, marginTop: 8 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  name: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  meta: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
  total: { color: '#6B7280', fontSize: 12, marginTop: 12 },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
