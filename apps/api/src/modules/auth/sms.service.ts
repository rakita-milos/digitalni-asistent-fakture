import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { env } from '../../config/env';

/**
 * SMS adapter (§2: provajder TBD).
 * U razvoju i testovima koristi se `log` režim: poruka ide u log i pamti se
 * zadnja poruka (za e2e test OTP toka). Pravi adapter se dodaje kad se izabere provajder.
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

    if (env.SMS_PROVIDER === 'log' && env.NODE_ENV === 'production') {
      throw new Error('SMS provajder nije konfigurisan (SMS_PROVIDER=log u produkciji)');
    }

    this.logger.log(`SMS (${env.SMS_PROVIDER}) -> ${phone}: ${text}`);
  }
}
