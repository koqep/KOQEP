// MUST stay first — Sentry instrumentation requires this (M6 Slice B).
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
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
  // GEÇİCİ — M6b Slice A doğrulaması. Render'ın X-Forwarded-For'a gerçek
  // istemci IP'sini BAŞA mı SONA mı eklediğini production'da kanıtlamak
  // için (docs/milestones/M6b-traffic-log-5651.md'nin founder-task
  // listesi). Founder onayı gelince BİR SONRAKİ küçük commit'te
  // kaldırılacak - /health ile sınırlı, gerçek kullanıcı trafiğinde IP
  // loglamıyor.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health') {
      const xff = req.headers['x-forwarded-for'];
      console.log(
        `[M6B-XFF-VERIFY] xff="${Array.isArray(xff) ? xff.join(',') : (xff ?? '')}" remoteAddress="${req.socket.remoteAddress ?? ''}"`,
      );
    }
    next();
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
