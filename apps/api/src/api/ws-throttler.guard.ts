import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { Socket } from 'socket.io';

// @nestjs/throttler'ın kendi belgelediği WS deseni: APP_GUARD/useGlobalGuards
// WS için çalışmaz, handleRequest'i elden geçirmek ve her gateway handler'ına
// @UseGuards ile elle uygulamak gerekiyor. Tracker IP değil - handleConnection'da
// zaten set edilen client.data.userId (THREAT-MODEL satır 5'in "per-user" tanımı).
@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, generateKey } =
      requestProps;
    const throttlerName = throttler.name ?? 'default';

    const client = context.switchToWs().getClient<Socket>();
    const tracker = (client.data as { userId: string }).userId;
    const key = generateKey(context, tracker, throttlerName);
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );

    if (isBlocked) {
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }
}
