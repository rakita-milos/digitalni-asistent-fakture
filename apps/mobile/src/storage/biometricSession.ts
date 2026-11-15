import * as Keychain from 'react-native-keychain';

/**
 * M-01 biometrijska prijava i zaključavanje aplikacije.
 *
 * Keychain zapis je vezan za biometriju (`ACCESS_CONTROL.BIOMETRY_ANY`) — čitanje uvijek
 * pokreće sistemski prompt, a bez uspješne biometrije sistem ne vraća podatke.
 * Zapis se briše pri odjavi i pri promjeni lozinke (stara lozinka više ne važi).
 */
const SERVICE = 'digitalni-asistent.biometric';

const PROMPT = {
  title: 'Prijava biometrijom',
  subtitle: 'Digitalni Asistent',
  description: 'Potvrdite identitet otiskom prsta ili licem.',
  cancel: 'Odustani',
};

export interface BiometricCredentials {
  identifier: string;
  password: string;
}

/** Podržava li uređaj biometriju (otiska/ lice) — bez prompta. */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    return (await Keychain.getSupportedBiometryType()) !== null;
  } catch {
    return false;
  }
}

/** Postoji li upamćena biometrijska prijava (bez prompta). */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  try {
    return await Keychain.hasGenericPassword({ service: SERVICE });
  } catch {
    return false;
  }
}

/** Upamti prijavu uz biometrijsku zaštitu; vraća `false` ako uređaj ne podržava ili je otkazano. */
export async function saveBiometricCredentials(
  identifier: string,
  password: string,
): Promise<boolean> {
  try {
    const result = await Keychain.setGenericPassword(identifier, password, {
      service: SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      authenticationPrompt: PROMPT,
    });

    return result !== false;
  } catch {
    return false;
  }
}

/**
 * Pročitaj upamćenu prijavu — pokreće biometrijski prompt.
 * `null` znači: nema zapisa, korisnik je odustao ili biometrija nije dostupna.
 */
export async function readBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: SERVICE,
      authenticationPrompt: PROMPT,
    });

    if (!credentials) {
      return null;
    }

    return { identifier: credentials.username, password: credentials.password };
  } catch {
    return null;
  }
}

/** Zaboravi biometrijsku prijavu (odjava, promjena lozinke, isključivanje u podešavanjima). */
export async function clearBiometricCredentials(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // Nema zapisa ili Keychain nije dostupan — nema šta da se briše.
  }
}
