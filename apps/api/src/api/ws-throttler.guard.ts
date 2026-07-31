import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

// @nestjs/throttler'ın kendi belgelediği WS deseni: APP_GUARD/useGlobalGuards
// WS için çalışmaz, handleRequest'i elden geçirmek ve her gateway handler'ına
// @UseGuards ile elle uygulamak gerekiyor. Tracker IP değil - handleConnection'da
// zaten set edilen client.data.userId (THREAT-MODEL satır 5'in "per-user" tanımı).
@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  // Varsayılan throwThrottlingException düz bir HttpException (ThrottlerException)
  // fırlatıyor - NestJS'in varsayılan WS exception filtresi WsException
  // DIŞINDAKİ her şeyi jenerik "Internal server error"a çeviriyor (kaynak
  // kodda doğrulandı, bkz. M2.5 Slice D plan notları). WsException fırlatınca
  // obje payload'ı olduğu gibi client'a emit ediliyor - frontend code'a bakıp
  // kendi Türkçe mesajını gösteriyor (AuthView.tsx'in TOTP_REQUIRED deseni).
  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    // İmza, base sınıfın çağırdığı şekliyle birebir uyuşmalı - ikisi de
    // kullanılmıyor, sadece yapısal bir sinyal (code) fırlatılıyor.
    void context;
    void throttlerLimitDetail;
    throw new WsException({ status: 'error', code: 'RATE_LIMITED' });
  }

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
