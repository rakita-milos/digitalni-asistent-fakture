/**
 * Provjere produkcijske konfiguracije koje se **loguju pri startu**, bez mijenjanja ponašanja.
 *
 * Cilj: da staging/produkcija ne ostanu tiho u razvojnom režimu (mock fiskalizacija, SMS u log,
 * localhost linkovi, bez monitoringa). Ne bacamo grešku — pilot svjesno radi sa mock fiskalizacijom
 * do G0, ali operater mora da vidi upozorenje u logu.
 */

export interface ProductionConfigSnapshot {
  NODE_ENV: string;
  ESIR_MODE: string;
  SMS_PROVIDER: string;
  PUBLIC_API_URL: string;
  WEB_APP_URL: string;
  SENTRY_DSN?: string;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return true;
  }
}

/** Vraća listu upozorenja za produkciju; u razvoju/testu je lista prazna. */
export function collectProductionWarnings(config: ProductionConfigSnapshot): string[] {
  if (config.NODE_ENV !== 'production') return [];

  const warnings: string[] = [];

  if (config.ESIR_MODE === 'mock') {
    warnings.push('ESIR_MODE=mock — fiskalizacija je simulirana (G0 nije zatvoren).');
  }
  if (config.SMS_PROVIDER === 'log') {
    warnings.push('SMS_PROVIDER=log — SMS poruke se ne šalju, samo se loguju.');
  }
  if (isLocalhostUrl(config.PUBLIC_API_URL) || isLocalhostUrl(config.WEB_APP_URL)) {
    warnings.push(
      'PUBLIC_API_URL/WEB_APP_URL pokazuju na localhost — linkovi u e-mail/SMS porukama neće raditi.',
    );
  }
  if (!config.SENTRY_DSN) {
    warnings.push('SENTRY_DSN nije postavljen — greške ostaju samo u logu.');
  }

  return warnings;
}
