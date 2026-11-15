import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../state/authStore';

/**
 * M-01 — zaključan ekran poslije restarta kada je uključena biometrijska prijava.
 * Podaci firme se ne prikazuju dok korisnik ne potvrdi identitet.
 */
export function LockScreen() {
  const unlockWithBiometrics = useAuthStore((state) => state.unlockWithBiometrics);
  const continueWithPassword = useAuthStore((state) => state.continueWithPassword);
  const error = useAuthStore((state) => state.error);
  const [isUnlocking, setIsUnlocking] = useState(false);

  async function handleUnlock(): Promise<void> {
    setIsUnlocking(true);
    try {
      await unlockWithBiometrics();
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Digitalni Asistent</Text>
        <Text style={styles.subtitle}>Aplikacija je zaključana</Text>
        <Text style={styles.hint}>
          Potvrdite identitet biometrijom da nastavite sa radom.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void handleUnlock()}
          disabled={isUnlocking}
          testID="lock-unlock"
        >
          {isUnlocking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Otključaj biometrijom</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => void continueWithPassword()}
          disabled={isUnlocking}
          testID="lock-password"
        >
          <Text style={styles.linkText}>Prijavi se lozinkom</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, gap: 8 },
  title: { color: '#1D4ED8', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#1F2937', fontSize: 16 },
  hint: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8 },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
});
