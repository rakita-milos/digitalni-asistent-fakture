import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../state/authStore';

/** Placeholder poslije prijave — M-03 Početna dolazi u Sprintu 2/4. */
export function HomeScreen() {
  const company = useAuthStore((state) => state.company);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <View style={styles.container}>
      <Text style={styles.company}>{company?.name ?? 'Firma'}</Text>
      <Text style={styles.user}>{user?.email ?? ''}</Text>
      <Text style={styles.note}>Sprint 1 — prijava radi. Početna i fakture dolaze u sljedećim sprintovima.</Text>

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
