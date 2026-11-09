import type {
  CreateCustomerInput,
  ListQuery,
  UpdateCustomerInput,
} from '@digitalni-asistent/shared';

import { apiRequest } from './client';

export interface CustomerDto {
  id: string;
  name: string;
  jib: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  note: string | null;
  archivedAt: string | null;
}

export interface CustomerListResponse {
  items: CustomerDto[];
  total: number;
}

export function listCustomers(query: Partial<ListQuery> = {}): Promise<CustomerListResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  const suffix = params.toString();
  return apiRequest<CustomerListResponse>(`/customers${suffix ? `?${suffix}` : ''}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerDto> {
  return apiRequest<CustomerDto>('/customers', { method: 'POST', body: input });
}

export function updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDto> {
  return apiRequest<CustomerDto>(`/customers/${id}`, { method: 'PATCH', body: input });
}
