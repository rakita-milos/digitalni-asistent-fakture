import { z } from 'zod';

import { DEVICE_PLATFORMS } from './auth';

/**
 * POST /devices/register (§6) — push token trenutnog uređaja.
 * Uređaj je već kreiran pri prijavi/registraciji; ovdje se dopunjuje push token.
 */
export const registerDeviceSchema = z.object({
  pushToken: z.string().trim().min(1).max(4096).nullable().optional(),
  platform: z.enum(DEVICE_PLATFORMS).optional(),
  appVersion: z.string().trim().max(50).optional(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
