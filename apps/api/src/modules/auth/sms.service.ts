import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { env } from '../../config/env';

/**
 * SMS adapter (§2: provajder TBD).
 *
 * - `log` — razvoj/test: poruka ide u log i pamti se zadnja poruka (za e2e OTP tok).
 * - `http` — generički provajder (T12-6): POST JSON `{ to, message, sender }` na `SMS_HTTP_URL`,
 *   sa `Authorization: Bearer <SMS_HTTP_TOKEN | SMS_API_KEY>`; izbor provajdera je odluka vlasnika.
 *
 * U produkciji `log` namjerno pada da se ne desi „tiho“ ne-slanje.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  lastMessage?: { phone: string; text: string };

  async send(phone: string, text: string): Promise<void> {
    if (!env.FEATURE_SMS_ENABLED) {
      throw new ServiceUnavailableException('SMS slanje je privremeno isključeno');
    }

    this.lastMessage = { phone, text };

    // Prazna vrijednost u .env (SMS_PROVIDER=) se ponaša kao `log` — starije konfiguracije
    // ne smiju pasti na „nepoznat provajder“; u produkciji `log` i dalje baca grešku.
    const provider = env.SMS_PROVIDER?.trim() || 'log';

    if (provider === 'log') {
      if (env.NODE_ENV === 'production') {
        throw new Error('SMS provajder nije konfigurisan (SMS_PROVIDER=log u produkciji)');
      }

      this.logger.log(`SMS (log) -> ${phone}: ${text}`);
      return;
    }

    if (provider === 'http') {
      await this.sendHttp(phone, text);
      return;
    }

    throw new ServiceUnavailableException(`Nepoznat SMS provajder: ${provider}`);
  }

  /** Generički HTTP adapter — provajder se bira konfiguracijom, ne kodom. */
  private async sendHttp(phone: string, text: string): Promise<void> {
    const url = env.SMS_HTTP_URL?.trim();

    if (!url) {
      throw new ServiceUnavailableException('SMS_HTTP_URL nije konfigurisan');
    }

    const token = env.SMS_HTTP_TOKEN?.trim() || env.SMS_API_KEY?.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.SMS_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: phone,
          message: text,
          ...(env.SMS_SENDER_ID ? { sender: env.SMS_SENDER_ID } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Tijelo odgovora ne logujemo (može sadržati broj telefona).
        this.logger.error(`SMS provajder je vratio HTTP ${response.status}`);
        throw new Error(`SMS provajder je vratio ${response.status}`);
      }

      this.logger.log(`SMS (http) poslan na ${phone}`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.logger.error(`SMS provajder nije odgovorio u ${env.SMS_HTTP_TIMEOUT_MS} ms`);
        throw new Error('SMS provajder nije odgovorio na vrijeme');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
