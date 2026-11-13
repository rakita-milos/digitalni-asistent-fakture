import { Global, Module } from '@nestjs/common';

import { AnalyticsService } from './analytics.service';

/** Globalni modul: svaki servis može emitovati događaj bez importa modula. */
@Global()
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
