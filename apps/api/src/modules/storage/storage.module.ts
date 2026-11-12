import { Global, Module } from '@nestjs/common';

import { R2StorageService } from './r2-storage.service';
import { R2_CONFIG, r2ConfigFromEnv } from './r2.config';

@Global()
@Module({
  providers: [
    { provide: R2_CONFIG, useFactory: r2ConfigFromEnv },
    R2StorageService,
  ],
  exports: [R2StorageService],
})
export class StorageModule {}
