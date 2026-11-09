import * as Keychain from 'react-native-keychain';

import type { AuthSession } from '@digitalni-asistent/shared';

const SERVICE = 'digitalni-asistent.session';

/**
 * Tokeni idu u Keychain/Keystore, nikad u AsyncStorage (§10).
 * Čuvamo cijelu sesiju (tokeni + korisnik + firma) da restore ne traži mrežu.
 */
export async function saveSession(session: AuthSession): Promise<void> {
  await Keychain.setGenericPassword('session', JSON.stringify(session), { service: SERVICE });
}

export async function loadSession(): Promise<AuthSession | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credentials) {
    return null;
  }

  try {
    return JSON.parse(credentials.password) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
