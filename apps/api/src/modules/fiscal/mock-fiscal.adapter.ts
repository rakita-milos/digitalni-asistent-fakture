import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import type { FiscalAdapter, FiscalInvoiceData, FiscalResult } from './fiscal.types';

/**
 * MOCK fiskalizacija (§18: do odgovora operatera radi se mock).
 * PFR i QR sadržaj su PLACEHOLDERI — pravi format zavisi od Pravilnika (⚠ §11, G0).
 * Nikad se ne smije koristiti u produkciji (env ESIR_MODE=mock).
 */
@Injectable()
export class MockFiscalAdapter implements FiscalAdapter {
  private readonly logger = new Logger(MockFiscalAdapter.name);

  issue(data: FiscalInvoiceData): Promise<FiscalResult> {
    const pfr = `MOCK-${data.company.jib}-${randomBytes(6).toString('hex').toUpperCase()}`;
    const qrPayload = JSON.stringify({
      pfr,
      jib: data.company.jib,
      number: data.number,
      total: data.totalFening,
      issuedAt: data.issueDate,
      mock: true,
    });

    const request = { ...data, mode: 'mock' };
    const response = { status: 'ISSUED', pfr, qrPayload, mode: 'mock' };

    this.logger.warn(
      `MOCK fiskalizacija za ${data.number} (PFR ${pfr}) — zamijeniti ESIR adapterom prije produkcije`,
    );

    return Promise.resolve({ pfr, qrPayload, request, response });
  }
}
