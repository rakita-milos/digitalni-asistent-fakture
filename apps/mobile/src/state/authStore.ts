import { create } from 'zustand';

import type { AuthSession } from '@digitalni-asistent/shared';

import { ApiError } from '../api/client';
import { login as loginRequest } from '../api/auth';
import { clearSession, loadSession, saveSession } from '../storage/secureStorage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: AuthSession['user'] | null;
  company: AuthSession['company'] | null;
  error: string | null;
  isSubmitting: boolean;
  restore: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  company: null,
  error: null,
  isSubmitting: false,

  restore: async () => {
    const session = await loadSession();
    if (!session) {
      set({ status: 'signedOut' });
      return;
    }
    set({
      status: 'signedIn',
      user: session.user,
      company: session.company,
    });
  },

  signIn: async (identifier, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const session = await loginRequest(identifier, password);
      await saveSession(session);
      set({
        status: 'signedIn',
        user: session.user,
        company: session.company,
        isSubmitting: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Prijava nije uspjela. Provjerite mrežu.';
      set({ isSubmitting: false, error: message });
      return false;
    }
  },

  signOut: async () => {
    await clearSession();
    set({ status: 'signedOut', user: null, company: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
