import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './jwt-auth.guard';

const LIMIT = 10;
const TTL_MS = 60 * 60 * 1000;

// report-throttler.guard.ts'in BİREBİR yapısal kopyası - global APP_GUARD
// (varsayılan, IP-bazlı ThrottlerGuard) ile çift-sayım riski olmadan
// per-user (IP değil) bir rate limit için aynı kurulu desen. M11c Slice A:
// milestone'un literal AC'sinde YOK ama şifre kontrolünün kendisiyle
// DOĞRUDAN motive - bir oda şifresi sınırsız tahmine açık olmamalı.
// blockDuration=TTL_MS (0 DEĞİL) - storage.increment'in blockDuration=0'ı
// aynı çağrı içinde sıfırlama davranışı burada da geçerli. LIMIT=10/saat
// oda-oluşturma/rapor limitlerinden GEVŞEK - normal kullanımda birden
// fazla odaya (şifresiz dahil) katılmak sık bir eylem, TÜM join'lere
// (sadece yanlış şifre denemelerine değil) uygulanıyor - report-throttler
// ile AYNI basitlik seviyesi.
@Injectable()
export class RoomJoinThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tracker = request.user?.sub ?? request.ip;
    const key = `room-join-throttle:${context.getClass().name}:${context.getHandler().name}:${tracker}`;

    const { isBlocked } = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      TTL_MS,
      'room-join',
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
