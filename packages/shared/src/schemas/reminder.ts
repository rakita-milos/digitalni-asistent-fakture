import { z } from 'zod';

/**
 * Podsjetnici — §6 (/reminder-settings, /invoices/:id/remind, /reminders) i §7.9.
 * Šablon mora sadržavati broj i iznos; max 4 automatska podsjetnika.
 */
export const REMINDER_PLACEHOLDERS = ['{broj}', '{iznos}', '{rok}', '{firma}'] as const;

export const DEFAULT_REMINDER_TEMPLATE =
  'Poštovani, račun {broj} u iznosu {iznos} dospijeva {rok}. Molimo izmirenje. Hvala, {firma}.';

export const MAX_AUTOMATIC_REMINDERS = 4;

export const reminderScheduleItemSchema = z.object({
  /** Negativno = prije roka, pozitivno = poslije roka (dani). */
  offsetDays: z.number().int().min(-30).max(30),
  kind: z.string().trim().min(1).max(30).default('sms'),
});
export type ReminderScheduleItem = z.infer<typeof reminderScheduleItemSchema>;

export const reminderTemplateSchema = z.object({
  text: z.string().trim().min(10).max(500),
});
export type ReminderTemplate = z.infer<typeof reminderTemplateSchema>;

export const updateReminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    schedule: z.array(reminderScheduleItemSchema).max(MAX_AUTOMATIC_REMINDERS),
    template: reminderTemplateSchema,
  })
  .refine((value) => value.template.text.includes('{broj}'), {
    message: 'Šablon mora sadržavati {broj}',
    path: ['template', 'text'],
  })
  .refine((value) => value.template.text.includes('{iznos}'), {
    message: 'Šablon mora sadržavati {iznos}',
    path: ['template', 'text'],
  });
export type UpdateReminderSettingsInput = z.infer<typeof updateReminderSettingsSchema>;
