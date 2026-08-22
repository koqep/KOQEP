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
  // GEÇİCİ — M6b Slice A doğrulaması. Render'ın X-Forwarded-For davranışı
  // ilk turda doğrulandı (sağdan sona ekleme, Cloudflare gerçekten araya
  // giriyor - client-ip.util.ts'in kendi yorumuna bakın). Bu log artık
  // SADECE isteğe bağlı bir son teyit için duruyor - cf-connecting-ip'nin
  // gerçekten gelip gelmediğini + değerinin gerçek IP'yle eşleştiğini
  // gözle kontrol etmek isteyen founder için. Algoritmanın DOĞRULUĞU buna
  // bağlı DEĞİL. Kaldırma kararı founder'a bırakıldı, zorunlu değil.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health') {
      const toDisplay = (value: string | string[] | undefined): string =>
        Array.isArray(value) ? value.join(',') : (value ?? '');
      console.log(
        `[M6B-XFF-VERIFY] xff="${toDisplay(req.headers['x-forwarded-for'])}" cfConnectingIp="${toDisplay(req.headers['cf-connecting-ip'])}" remoteAddress="${req.socket.remoteAddress ?? ''}"`,
      );
    }
    next();
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
