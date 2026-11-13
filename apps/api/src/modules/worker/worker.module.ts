import { Module } from '@nestjs/common';

import { MonitoringModule } from '../../common/monitoring/monitoring.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RemindersModule } from '../reminders/reminders.module';
import { FiscalRetryWorker } from './fiscal-retry.worker';
import { ReminderWorker } from './reminder.worker';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MonitoringModule,
    AnalyticsModule,
    AuthModule,
    InvoicesModule,
    RemindersModule,
  ],
  providers: [ReminderWorker, FiscalRetryWorker],
})
export class WorkerModule {}