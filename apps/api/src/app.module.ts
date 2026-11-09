import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ItemsModule } from './modules/items/items.module';
import { TaxRatesModule } from './modules/tax-rates/tax-rates.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CompanyModule,
    CustomersModule,
    ItemsModule,
    InvoicesModule,
    TaxRatesModule,
  ],
})
export class AppModule {}
