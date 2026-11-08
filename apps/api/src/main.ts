import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Pre-Deployment Checklist §4: CORS samo za poznate origin-e, nikad "*".
  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  // Swagger — Sprint 0 deliverable (MASTER PROMPT §14).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Digitalni Asistent API')
    .setDescription('REST API — rute i pravila iz MASTER PROMPT-a §6')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);

  Logger.log(`API sluša na http://localhost:${port} (Swagger: /docs)`, 'Bootstrap');
}

void bootstrap();
