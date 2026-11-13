import type { UpdateCompanyInput } from '@digitalni-asistent/shared';

import { apiRequest } from './client';

/** Profil firme (GET/PATCH /company, §6) — koristi se u M-02 setup-u i M-05 formi. */
export interface CompanyDto {
  id: string;
  name: string;
  jib: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  efdId: string | null;
  numberingPrefix: string;
  numberingYear: number;
  numberingNext: number;
  defaultDueDays: number;
  createdAt: string;
  setupCompletedAt?: string | null;
}

export function getCompany(): Promise<CompanyDto> {
  return apiRequest<CompanyDto>('/company');
}

export function updateCompany(input: UpdateCompanyInput): Promise<CompanyDto> {
  return apiRequest<CompanyDto>('/company', { method: 'PATCH', body: input });
}

/** Server-side signal da je setup završen (S11-7; idempotentno). */
export function completeSetup(): Promise<{
  setupCompletedAt: string | null;
  alreadyCompleted: boolean;
}> {
  return apiRequest('/company/setup-complete', { method: 'POST' });
}
