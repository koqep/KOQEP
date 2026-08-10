// MUST stay first — Sentry instrumentation requires this (M6 Slice B).
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getAllowedOrigins } from './allowed-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: getAllowedOrigins(process.env.WEB_ORIGIN) });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
