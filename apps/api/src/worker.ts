import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { env } from './config/env';
import { collectProductionWarnings } from './config/production-warnings';
import { WorkerModule } from './modules/worker/worker.module';

/** Odvojen proces: `pnpm --filter api worker` (mora postojati `dist/worker.js`). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  const configLogger = new Logger('Config');
  for (const warning of collectProductionWarnings(env)) {
    configLogger.warn(warning);
  }

  Logger.log('Worker pokrenut: podsjetnici (60 s) + fiskalni retry (5 min)', 'Worker');
}

void bootstrap();
