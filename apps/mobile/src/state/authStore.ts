import type { AuthSession, AuthUser } from '@digitalni-asistent/shared';

import { login as loginRequest, logout as logoutRequest } from '../api/auth';
import { ApiError, setAccessToken } from '../api/client';
import {
  clearBiometricCredentials,
  isBiometricLoginEnabled,
  isBiometricSupported,
  readBiometricCredentials,
  saveBiometricCredentials,
} from '../storage/biometricSession';
import { clearSession, loadSession, saveSession } from '../storage/secureStorage';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'locked' | 'signedOut' | 'signedIn';

/**
 * Sesija učitana pri startu se primjenjuje tek poslije biometrijskog otključavanja —
 * tako aplikacija ne pokazuje podatke firme dok vlasnik ne potvrdi identitet (M-01).
 */
let pendingSession: AuthSession | null = null;

export const BIOMETRIC_CANCELLED_MESSAGE =
  'Otključavanje biometrijom je otkazano ili nije dostupno.';
export const BIOMETRIC_STALE_MESSAGE =
  'Upamćena prijava više nije važeća — prijavite se lozinkom.';

interface AuthState {
  status: AuthStatus;
  user: AuthSession['user'] | null;
  company: AuthSession['company'] | null;
  error: string | null;
  isSubmitting: boolean;
  /** Uređaj podržava biometriju (otisak/lice) i ima postavljen zaključavanje ekrana. */
  biometricAvailable: boolean;
  /** Postoji upamćena biometrijska prijava. */
  biometricEnrolled: boolean;
  restore: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  continueWithPassword: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  signInWithBiometrics: () => Promise<boolean>;
  enableBiometricLogin: (identifier: string, password: string) => Promise<boolean>;
  disableBiometricLogin: () => Promise<void>;
  applyUser: (user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function applySignedIn(
  set: (partial: Partial<AuthState>) => void,
  session: AuthSession,
): void {
  setAccessToken(session.accessToken);
  set({
    status: 'signedIn',
    user: session.user,
    company: session.company,
    error: null,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  company: null,
  error: null,
  isSubmitting: false,
  biometricAvailable: false,
  biometricEnrolled: false,

  restore: async () => {
    const session = await loadSession();
    const available = await isBiometricSupported();
    const enrolled = available && (await isBiometricLoginEnabled());
    set({ biometricAvailable: available, biometricEnrolled: enrolled });

    if (!session) {
      pendingSession = null;
      set({ status: 'signedOut' });
      return;
    }

    // Ako je biometrija upaljena, podaci se otkrivaju tek poslije uspješnog prompta.
    if (enrolled) {
      pendingSession = session;
      set({ status: 'locked' });
      return;
    }

    pendingSession = null;
    applySignedIn(set, session);
  },

  unlockWithBiometrics: async () => {
    const session = pendingSession;
    if (!session) {
      set({ status: 'signedOut' });
      return false;
    }

    const credentials = await readBiometricCredentials();
    if (!credentials) {
      set({ error: BIOMETRIC_CANCELLED_MESSAGE });
      return false;
    }

    pendingSession = null;
    applySignedIn(set, session);
    return true;
  },

  /** Korisnik odustaje od biometrije — sesija se briše, ali upamćena prijava ostaje. */
  continueWithPassword: async () => {
    pendingSession = null;
    await clearSession();
    setAccessToken(null);
    set({ status: 'signedOut', user: null, company: null, error: null });
  },

  signIn: async (identifier, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await loginRequest(identifier, password);
      await saveSession(session);
      applySignedIn(set, session);
      set({ isSubmitting: false });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Prijava nije uspjela. Provjerite mrežu.';
      set({ isSubmitting: false, error: message });
      return false;
    }
  },

  signInWithBiometrics: async () => {
    set({ isSubmitting: true, error: null });

    const credentials = await readBiometricCredentials();
    if (!credentials) {
      set({ isSubmitting: false, error: BIOMETRIC_CANCELLED_MESSAGE });
      return false;
    }

    try {
      const session = await loginRequest(credentials.identifier, credentials.password);
      await saveSession(session);
      applySignedIn(set, session);
      set({ isSubmitting: false });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Lozinka je promijenjena na drugom uređaju — upamćena prijava više ne važi.
        await clearBiometricCredentials();
        set({ isSubmitting: false, biometricEnrolled: false, error: BIOMETRIC_STALE_MESSAGE });
        return false;
      }

      const message =
        error instanceof ApiError ? error.message : 'Prijava nije uspjela. Provjerite mrežu.';
      set({ isSubmitting: false, error: message });
      return false;
    }
  },

  enableBiometricLogin: async (identifier, password) => {
    const saved = await saveBiometricCredentials(identifier, password);
    set({
      biometricEnrolled: saved,
      error: saved ? null : 'Biometrijska prijava nije uključena na ovom uređaju.',
    });
    return saved;
  },

  disableBiometricLogin: async () => {
    await clearBiometricCredentials();
    set({ biometricEnrolled: false });
  },

  /** Novi profil iz PATCH /auth/me — osvježi stanje i upamćenu sesiju. */
  applyUser: async (user) => {
    const session = await loadSession();
    if (session) {
      await saveSession({ ...session, user });
    }
    set({ user });
  },

  signOut: async () => {
    // Best-effort opoziv refresh tokena na serveru; odjava mora uspjeti i offline.
    try {
      await logoutRequest();
    } catch {
      // ignorišemo — lokalna odjava ide dalje
    }

    await clearSession();
    // Odjava briše i upamćenu biometrijsku prijavu (uređaj više ne nudi brzu prijavu).
    await clearBiometricCredentials();
    pendingSession = null;
    setAccessToken(null);
    set({
      status: 'signedOut',
      user: null,
      company: null,
      error: null,
      biometricEnrolled: false,
    });
  },

  clearError: () => set({ error: null }),
}));

/** Samo za testove — provjera da li postoji sesija koja čeka otključavanje. */
export function hasPendingSession(): boolean {
  return pendingSession !== null;
}
