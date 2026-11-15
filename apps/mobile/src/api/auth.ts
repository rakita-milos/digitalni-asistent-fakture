import { Platform } from 'react-native';

import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  UpdateProfileInput,
} from '@digitalni-asistent/shared';

import { apiRequest } from './client';

export function login(identifier: string, password: string): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    body: {
      identifier,
      password,
      device: { platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    },
  });
}

export interface CompanyProfile {
  id: string;
  name: string;
  jib: string;
  city: string;
}

export function getCompany(): Promise<CompanyProfile> {
  return apiRequest<CompanyProfile>('/company');
}

/** Opoziva refresh token trenutnog uređaja (§10). */
export function logout(): Promise<{ loggedOut: true }> {
  return apiRequest<{ loggedOut: true }>('/auth/logout', { method: 'POST' });
}

/**
 * PATCH /auth/me — profil (M-12). Telefon ide bez lozinke; promjena e-maila traži
 * `currentPassword` jer je e-mail identitet za prijavu i reset.
 */
export function updateProfile(input: UpdateProfileInput): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/auth/me', {
    method: 'PATCH',
    body: input,
  });
}

/** POST /auth/change-password — promjena lozinke; ostale sesije se opozivaju. */
export function changePassword(input: ChangePasswordInput): Promise<{ changed: true }> {
  return apiRequest<{ changed: true }>('/auth/change-password', {
    method: 'POST',
    body: input,
  });
}
