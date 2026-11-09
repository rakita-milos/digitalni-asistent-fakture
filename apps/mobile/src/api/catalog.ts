import { apiRequest } from './client';

/** Katalog artikala i porezne stope — puni M-05 formu (§6: GET /items, GET /tax-rates). */

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
