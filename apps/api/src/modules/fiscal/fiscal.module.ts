import { Module } from '@nestjs/common';

import { env } from '../../config/env';
import { MockFiscalAdapter } from './mock-fiscal.adapter';
import type { FiscalAdapter } from './fiscal.types';
import { FISCAL_ADAPTER } from './fiscal.types';

@Module({
  providers: [
    MockFiscalAdapter,
    {
      provide: FISCAL_ADAPTER,
      inject: [MockFiscalAdapter],
      useFactory: (mock: MockFiscalAdapter): FiscalAdapter => {
        if (env.ESIR_MODE === 'mock') {
          return mock;
        }
        // Prava integracija dolazi kad operater odgovori (G0); bolje pasti pri startu nego izdati nefiskalni račun.
        throw new Error(`ESIR_MODE=${env.ESIR_MODE} nije implementiran (G0)`);
      },
    },
  ],
  exports: [FISCAL_ADAPTER],
})
export class FiscalModule {}
