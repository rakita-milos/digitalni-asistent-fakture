import { z } from 'zod';

/**
 * GET/POST /subscriptions (§6) — pretplata firme.
 *
 * Napomena (§19): način naplate pretplate u RS još nije izabran (provajder, ciklus).
 * Do tada se pretplata samo evidentira: plan/status su slobodni stringovi (u §5 nema
 * enuma), a datumi i referenca provajdera su opcioni.
 */
export const upsertSubscriptionSchema = z.object({
  plan: z.string().trim().min(1).max(30),
  status: z.string().trim().min(1).max(30),
  trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable().optional(),
  providerRef: z.string().trim().max(200).nullable().optional(),
});
export type UpsertSubscriptionInput = z.infer<typeof upsertSubscriptionSchema>;
