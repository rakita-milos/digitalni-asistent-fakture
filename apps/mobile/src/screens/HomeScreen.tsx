import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../state/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** Placeholder poslije prijave — M-03 Početna dolazi u Sprintu 4. */
export function HomeScreen({ navigation }: Props) {
  const company = useAuthStore((state) => state.company);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <View style={styles.container}>
      <Text style={styles.company}>{company?.name ?? 'Firma'}</Text>
      <Text style={styles.user}>{user?.email ?? ''}</Text>

      <Pressable
        style={styles.primary}
        onPress={() => navigation.navigate('Customers')}
        testID="home-customers"
      >
        <Text style={styles.primaryText}>Kupci</Text>
      </Pressable>

      <Text style={styles.note}>
        Sprint 2 — fakture (API). Mobilni ekrani M-04/M-05 dolaze u sljedećem koraku.
      </Text>

      <Pressable style={styles.button} onPress={() => void signOut()} testID="logout">
        <Text style={styles.buttonText}>Odjavi se</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 24, justifyContent: 'center' },
  company: { color: '#1D4ED8', fontSize: 22, fontWeight: '700' },
  user: { color: '#1F2937', fontSize: 15, marginTop: 4 },
  primary: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  note: { color: '#6B7280', fontSize: 13, marginTop: 16 },
  button: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#B91C1C', fontWeight: '600' },
});
