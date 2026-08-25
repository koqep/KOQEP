import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../db/prisma.service';
import { getRealClientIp } from '../services/client-ip.util';
import { writeTrafficLogRow } from '../services/traffic-log-writer.util';
import { AuthenticatedRequest } from './jwt-auth.guard';

export const REST_SERVICE_TYPE = 'REST';
const HEALTH_CHECK_PATH = '/health';

// M6b Slice C: her REST isteğine (reddedilenler dahil) bir TrafficLog satırı
// yazar - Guard'lardan SONRA çalışan bir interceptor 401/429 gibi reddedilen
// istekleri hiç görmezdi, middleware Guard'lardan ÖNCE çalışıp res.on('finish')
// ile yanıt tamamlandığında yazdığı için tam kapsıyor (bkz. milestone Plan
// notları). Yazma ateşle-unut - Room.lastActivityAt/A17 deseniyle aynı,
// istek yanıtını bloklamıyor. Yazma+P2003-retry mantığı Slice D'de
// traffic-log-writer.util.ts'e çıkarıldı - messages.gateway.ts (WS) AYNI
// fonksiyonu kullanıyor.
@Injectable()
export class TrafficLogMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // req.path DEĞİL - Nest'in controller-prefix mount'u yüzünden global
    // middleware katmanında req.path '/health' yerine '/' dönebiliyor
    // (HealthController tek route'lu, alt-router'a mount ediliyor).
    // req.originalUrl her zaman gerçek, tam istek yolunu yansıtır.
    if (req.originalUrl === HEALTH_CHECK_PATH) {
      next();
      return;
    }

    const startedAt = new Date();
    const ipAddress = getRealClientIp(
      req.headers['x-forwarded-for'],
      req.headers['cf-connecting-ip'],
      req.socket.remoteAddress,
    );

    res.on('finish', () => {
      const endedAt = new Date();
      const userId = (req as Partial<AuthenticatedRequest>).user?.sub ?? null;
      const bytesTransferred = parseContentLength(
        res.getHeader('content-length'),
      );

      writeTrafficLogRow(
        this.prisma,
        {
          serviceType: REST_SERVICE_TYPE,
          ipAddress,
          startedAt,
          endedAt,
          connectionId: null,
          bytesTransferred,
          userId,
        },
        req.originalUrl,
      );
    });

    next();
  }
}

function parseContentLength(
  value: number | string | string[] | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
