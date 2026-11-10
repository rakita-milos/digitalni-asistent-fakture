import { apiRequest } from './client';

/** Pretplata firme (§6) — owner-only; MVP evidentira plan/status bez naplate (§19). */

export interface SubscriptionDto {
  id: string;
  companyId: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  providerRef: string | null;
}

export interface SubscriptionResponse {
  subscription: SubscriptionDto | null;
}

export function getSubscription(): Promise<SubscriptionResponse> {
  return apiRequest<SubscriptionResponse>('/subscriptions');
}
