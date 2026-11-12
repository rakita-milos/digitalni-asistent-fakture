import { env } from '../../config/env';

export const R2_CONFIG = Symbol('R2_CONFIG');

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  ttlSeconds: number;
}

/**
 * R2 je konfigurisan samo ako su prisutni ključevi i endpoint (ili account ID).
 * Bez kredencijala PDF se i dalje streamuje — ista ruta, isti ugovor (§6).
 */
export function r2ConfigFromEnv(): R2Config | null {
  const endpoint =
    env.R2_ENDPOINT?.trim() ||
    (env.R2_ACCOUNT_ID?.trim()
      ? `https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
      : undefined);

  if (
    !env.R2_ACCESS_KEY_ID?.trim() ||
    !env.R2_SECRET_ACCESS_KEY?.trim() ||
    !endpoint
  ) {
    return null;
  }

  return {
    accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim(),
    bucket: env.R2_BUCKET,
    endpoint,
    ttlSeconds: env.R2_SIGNED_URL_TTL_SECONDS,
  };
}
