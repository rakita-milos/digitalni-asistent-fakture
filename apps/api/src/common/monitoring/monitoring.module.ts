import { Global, Module } from '@nestjs/common';

import { MONITORING_OPTIONS, monitoringOptionsFromEnv } from './monitoring.options';
import { MonitoringService } from './monitoring.service';

@Global()
@Module({
  providers: [
    { provide: MONITORING_OPTIONS, useFactory: monitoringOptionsFromEnv },
    MonitoringService,
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
