import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { listCustomers, type CustomerDto } from '../api/customers';
import { ApiError } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Customers'>;

/** M-11 Kupci — lista sa pretragom (server-side `?q`). */
export function CustomersScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listCustomers({ q: search.trim() || undefined });
      setCustomers(response.items);
      setTotal(response.total);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Kupci nisu učitani. Provjerite mrežu.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Učitava pri fokusu ekrana (i poslije dodavanja kupca) uz debounce za pretragu.
  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => {
        void load(query);
      }, 300);
      return () => clearTimeout(timeout);
    }, [query, load]),
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Traži po imenu, JIB-u, telefonu…"
        autoCapitalize="none"
        testID="customers-search"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

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

      <Text style={styles.total}>Ukupno: {total}</Text>

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
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  name: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  meta: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
  error: { color: '#B91C1C', marginTop: 12 },
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
