import type { UpdateReminderSettingsInput } from '@digitalni-asistent/shared';

import { apiRequest } from './client';

/** Podsjetnici (§6, §7.9): podešavanja su owner-only, ručni podsjetnik šalje SMS. */

export interface ReminderScheduleItemDto {
  offsetDays: number;
  kind: string;
}

export interface ReminderSettingsDto {
  enabled: boolean;
  schedule: ReminderScheduleItemDto[];
  template: { text: string };
  senderId: string | null;
}

export interface ReminderDto {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  kind: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  providerMessageId: string | null;
  error: string | null;
}

/** GET /reminder-settings (owner). */
export function getReminderSettings(): Promise<ReminderSettingsDto> {
  return apiRequest<ReminderSettingsDto>('/reminder-settings');
}

/** PUT /reminder-settings (owner). */
export function updateReminderSettings(
  input: UpdateReminderSettingsInput,
): Promise<ReminderSettingsDto> {
  return apiRequest<ReminderSettingsDto>('/reminder-settings', { method: 'PUT', body: input });
}

/** POST /invoices/:id/remind — ručni SMS podsjetnik. */
export function sendInvoiceReminder(invoiceId: string): Promise<ReminderDto> {
  return apiRequest<ReminderDto>(`/invoices/${invoiceId}/remind`, {
    method: 'POST',
    body: {},
  });
}
