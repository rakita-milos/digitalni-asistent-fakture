import type { CreateTaxRateInput } from '@digitalni-asistent/shared';

import { apiRequest } from './client';

/** Katalog artikala i porezne stope — pune M-05 formu i M-02 setup (§6). */

export interface ItemDto {
  id: string;
  name: string;
  unit: string;
  priceFening: number;
  taxRateBp: number;
}

export interface ItemListResponse {
  items: ItemDto[];
  total: number;
}

export interface TaxRateDto {
  id: string;
  name: string;
  rateBp: number;
  sufCode: string;
  active: boolean;
}

export interface TaxRateListResponse {
  items: TaxRateDto[];
  total: number;
}

export function listItems(limit = 100): Promise<ItemListResponse> {
  return apiRequest<ItemListResponse>(`/items?limit=${limit}`);
}

export function listTaxRates(): Promise<TaxRateListResponse> {
  return apiRequest<TaxRateListResponse>('/tax-rates');
}

export function createTaxRate(input: CreateTaxRateInput): Promise<TaxRateDto> {
  return apiRequest<TaxRateDto>('/tax-rates', { method: 'POST', body: input });
}
