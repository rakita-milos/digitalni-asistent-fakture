import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * E-mail adapter (§2: provajder TBD).
 * U razvoju i testovima koristi se `log` režim: sadržaj ide u log i pamti se
 * zadnja poruka (za e2e testove reset toka). Pravi adapter se dodaje uz provajdera.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  lastMessage?: EmailMessage;

  async send(message: EmailMessage): Promise<void> {
    this.lastMessage = message;

    if (env.MAIL_PROVIDER === 'log' && env.NODE_ENV === 'production') {
      throw new Error('E-mail provajder nije konfigurisan (MAIL_PROVIDER=log u produkciji)');
    }

    this.logger.log(`Email (${env.MAIL_PROVIDER}) -> ${message.to}: ${message.subject}`);
  }
}
