import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MonitoringService } from './common/monitoring/monitoring.service';
import { env } from './config/env';
import { collectProductionWarnings } from './config/production-warnings';
import { parseTrustProxy } from './config/trust-proxy';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configLogger = new Logger('Config');
  for (const warning of collectProductionWarnings(env)) {
    configLogger.warn(warning);
  }

  const monitoring = app.get(MonitoringService);
  app.useGlobalFilters(new AllExceptionsFilter(monitoring));
  app.enableShutdownHooks();

  // Rate limit ide po IP-u (rate-limit.guard.ts). Iza Railway/Fly proxy-ja bez ovoga bi svi
  // korisnici dijelili IP proxy-ja, pa bi npr. 5 prijava/min važilo za cijeli sistem.
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  httpAdapter.set('trust proxy', parseTrustProxy(env.TRUST_PROXY, env.NODE_ENV));

  // Pre-Deployment Checklist §4: CORS samo za poznate origin-e, nikad "*".
  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Digitalni Asistent API')
    .setDescription('REST API — rute i pravila iz MASTER PROMPT-a §6')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(env.API_PORT);

  Logger.log(`API sluša na http://localhost:${env.API_PORT} (Swagger: /docs)`, 'Bootstrap');
}

void bootstrap();
