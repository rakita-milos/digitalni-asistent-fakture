import { StatusBar, StyleSheet, Text, View } from 'react-native';

import { APP_NAME, CURRENCY, TIMEZONE } from '@digitalni-asistent/shared';

/**
 * Sprint 0 — dokaz da RN (bare) + monorepo + @digitalni-asistent/shared rade.
 * Ekrani M-01…M-12 (MASTER PROMPT §8) dolaze u sprintovima 1–6.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>Sprint 0 — kostur monorepo-a</Text>
      <Text style={styles.meta}>
        {CURRENCY} · {TIMEZONE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  title: {
    color: '#1D4ED8',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#1F2937',
    fontSize: 16,
    marginTop: 8,
  },
  meta: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 16,
  },
});
