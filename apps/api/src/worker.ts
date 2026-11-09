import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './modules/worker/worker.module';

/** Odvojen proces: `pnpm --filter api worker` (mora postojati `dist/worker.js`). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  Logger.log('Worker pokrenut: podsjetnici (60 s) + fiskalni retry (5 min)', 'Worker');
}

void bootstrap();
