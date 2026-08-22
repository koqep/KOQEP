import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { getRealClientIp } from '../services/client-ip.util';
import { computeTrafficLogIntegrityHash } from '../services/traffic-log-integrity.util';
import { AuthenticatedRequest } from './jwt-auth.guard';

export const REST_SERVICE_TYPE = 'REST';
const HEALTH_CHECK_PATH = '/health';

// M6b Slice C: her REST isteğine (reddedilenler dahil) bir TrafficLog satırı
// yazar - Guard'lardan SONRA çalışan bir interceptor 401/429 gibi reddedilen
// istekleri hiç görmezdi, middleware Guard'lardan ÖNCE çalışıp res.on('finish')
// ile yanıt tamamlandığında yazdığı için tam kapsıyor (bkz. milestone Plan
// notları). Yazma ateşle-unut - Room.lastActivityAt/A17 deseniyle aynı,
// istek yanıtını bloklamıyor.
@Injectable()
export class TrafficLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TrafficLogMiddleware.name);

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

      this.writeRow(
        {
          serviceType: REST_SERVICE_TYPE,
          ipAddress,
          startedAt,
          endedAt,
          bytesTransferred,
          userId,
        },
        req.originalUrl,
      );
    });

    next();
  }

  // POST /auth/delete-account gibi bir istekte req.user.sub yazma anında
  // ARTIK var olmayabilir - handler kendi transaction'ında User satırını
  // hard-delete ettikten SONRA bu ateşle-unut yazma çalışıyor, FK ihlaline
  // (P2003) düşüyor. Hata YUTULMUYOR - userId'siz (null) TEK bir yeniden
  // deneme yapılıyor, ADR-0005'in "silinen hesap → null" ilkesiyle zaten
  // tutarlı bir sonuç (backfill-room-members.ts'teki P2003 retry deseniyle
  // aynı). integrityHash de null userId'yle YENİDEN hesaplanıyor - aksi
  // halde satırın kendi bütünlük kanıtı, gerçekte saklanan değeri değil,
  // silinen orijinal userId'yi yansıtırdı.
  private writeRow(
    fields: {
      serviceType: string;
      ipAddress: string;
      startedAt: Date;
      endedAt: Date;
      bytesTransferred: number | null;
      userId: string | null;
    },
    requestPath: string,
  ): void {
    const integrityHash = computeTrafficLogIntegrityHash({
      serviceType: fields.serviceType,
      ipAddress: fields.ipAddress,
      startedAt: fields.startedAt,
      endedAt: fields.endedAt,
      connectionId: null,
      userId: fields.userId,
    });

    this.prisma.trafficLog
      .create({
        data: { ...fields, connectionId: null, integrityHash },
      })
      .catch((error: unknown) => {
        if (
          fields.userId !== null &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          this.writeRow({ ...fields, userId: null }, requestPath);
          return;
        }
        this.logger.error(
          `TrafficLog satırı yazılamadı (path=${requestPath}): ${(error as Error).message}`,
        );
      });
  }
}

function parseContentLength(
  value: number | string | string[] | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
