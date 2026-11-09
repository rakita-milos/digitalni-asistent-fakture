import { apiRequest } from './client';

/** Profil firme (GET /company, §6) — mobilnom su potrebni samo broj dana do roka i JIB. */
export interface CompanyDto {
  id: string;
  name: string;
  jib: string;
  defaultDueDays: number;
  numberingPrefix: string;
  numberingYear: number;
}

export function getCompany(): Promise<CompanyDto> {
  return apiRequest<CompanyDto>('/company');
}
