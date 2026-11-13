import { Module } from '@nestjs/common';

import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ItemsModule } from './modules/items/items.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SyncModule } from './modules/sync/sync.module';
import { TaxRatesModule } from './modules/tax-rates/tax-rates.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    StorageModule,
    MonitoringModule,
    HealthModule,
    AccountModule,
    AuthModule,
    CompanyModule,
    CustomersModule,
    DevicesModule,
    ItemsModule,
    InvoicesModule,
    PaymentsModule,
    RemindersModule,
    ReportsModule,
    SubscriptionsModule,
    SyncModule,
    TaxRatesModule,
  ],
  providers: [IdempotencyInterceptor],
})
export class AppModule {}
