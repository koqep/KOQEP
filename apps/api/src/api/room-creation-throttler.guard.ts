import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { AuthenticatedRequest } from './jwt-auth.guard';

const LIMIT = 1;
const TTL_MS = 24 * 60 * 60 * 1000;

// UserThrottlerGuard'ın (invites) birebir yapısal kopyası - THREAT-MODEL
// satır 6'nın "1/user/24h" oda oluşturma sınırı, aynı per-user (IP değil)
// tracker ihtiyacı. ThrottlerGuard'ı BİLEREK extend etmiyor - global
// APP_GUARD ile çift sayım riskini önlemek için UserThrottlerGuard'da
// zaten çözülmüş aynı sorun (bkz. o dosyadaki yorum). blockDuration=TTL_MS
// (0 DEĞİL) - aynı yorum, storage.increment'in blockDuration=0'ı aynı
// çağrı içinde sıfırlama davranışı burada da geçerli.
@Injectable()
export class RoomCreationThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tracker = request.user?.sub ?? request.ip;
    const key = `room-creation-throttle:${context.getClass().name}:${context.getHandler().name}:${tracker}`;

    const { isBlocked } = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      TTL_MS,
      'room-creation',
    );

    if (isBlocked) {
      throw new ThrottlerException();
    }

    return true;
  }
}
