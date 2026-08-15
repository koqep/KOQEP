// MUST stay first — Sentry instrumentation requires this (M6 Slice B).
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getAllowedOrigins } from './allowed-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // credentials:true - M7a Slice A: httpOnly refresh-token/CSRF cookie'leri
  // apps/web'in farklı origin'inden (WEB_ORIGIN) gönderilip alınabilsin diye.
  // origin zaten somut bir dizi döndürüyor (wildcard değil), credentials
  // ile birlikte kullanılması güvenli.
  app.enableCors({
    origin: getAllowedOrigins(process.env.WEB_ORIGIN),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
