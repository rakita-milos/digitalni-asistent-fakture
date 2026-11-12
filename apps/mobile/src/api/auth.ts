import { Platform } from 'react-native';

import type { AuthSession } from '@digitalni-asistent/shared';

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
