import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CustomersModule, InvoicesModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
