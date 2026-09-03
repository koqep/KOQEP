import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './jwt-auth.guard';

const LIMIT = 5;
const TTL_MS = 60 * 60 * 1000;

// room-creation-throttler.guard.ts'in BİREBİR yapısal kopyası - global
// APP_GUARD (varsayılan, IP-bazlı ThrottlerGuard) ile çift-sayım riski
// olmadan per-user (IP değil) bir rate limit için aynı kurulu desen
// (bkz. o dosyadaki ve eski, M4 Slice B'de silinen user-throttler.guard.ts'in
// yorumları). blockDuration=TTL_MS (0 DEĞİL) - storage.increment'in
// blockDuration=0'ı aynı çağrı içinde sıfırlama davranışı burada da geçerli.
// Limit 5/saat TAHMİNİ - eski, kaldırılmış davet-üretme limitiyle aynı
// sayı, bu slice'ın kendi turunda kesinleşen bir başlangıç.
@Injectable()
export class ReportThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tracker = request.user?.sub ?? request.ip;
    const key = `report-throttle:${context.getClass().name}:${context.getHandler().name}:${tracker}`;

    const { isBlocked } = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      TTL_MS,
      'report',
    );

    if (isBlocked) {
      // M9 Slice C: room-creation-throttler.guard.ts'in AYNI gerekçesi -
      // ThrottlerException {code,...} obje literalini kabul etmiyor,
      // HttpException'a geçiliyor (status 429 AYNI kalıyor).
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Çok fazla istek gönderdin, biraz sonra tekrar dene.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
