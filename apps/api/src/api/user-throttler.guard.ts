import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { AuthenticatedRequest } from './jwt-auth.guard';

const LIMIT = 5;
const TTL_MS = 60 * 60 * 1000;

// Sadece IP yerine kimliklenmiş kullanıcıya göre sınırlar - THREAT-MODEL
// satır 1'in "per-inviter" tanımı IP değil kimlik demek (aynı kullanıcı
// farklı IP'ler kullanabilir). Her zaman JwtAuthGuard'dan sonra kullanılmalı
// ki req.user zaten set edilmiş olsun.
//
// ThrottlerGuard'ı extend ETMİYOR, bilerek: bu route zaten global APP_GUARD
// (varsayılan, IP-bazlı ThrottlerGuard) tarafından da kontrol ediliyor. İki
// ThrottlerGuard alt sınıfı aynı ThrottlerModuleOptions'ı (aynı isimli
// throttler'ları) paylaşır, bu yüzden ikisini de extend edip @Throttle()
// metadata'sını okutmak iki AYRI limit uygulamış oluyordu (biri IP'ye, biri
// kullanıcıya göre) - gerçek testte yakalandı (3. istekte beklenmedik 429,
// çünkü test client'ı aynı IP'yi paylaşıyordu). Bunun yerine sadece
// ThrottlerStorage'ı (paylaşılan in-memory sayaç) ve ThrottlerException'ı
// (aynı hata sınıfı) yeniden kullanan, kendi başına bir CanActivate - global
// guard'ın throttler listesine hiç girmiyor, tek amacı bu route.
@Injectable()
export class UserThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tracker = request.user?.sub ?? request.ip;
    const key = `user-throttle:${context.getClass().name}:${context.getHandler().name}:${tracker}`;

    // blockDuration=TTL_MS (0 DEĞİL): storage.increment'in kendi
    // implementasyonu blockDuration=0 verilince bloğu AYNI çağrı içinde
    // hemen sıfırlıyor (blockExpiresAt = now+0 = zaten süresi dolmuş sayılıyor)
    // - gerçek testte yakalandı (6. istek 429 yerine 201 döndü). Base
    // ThrottlerGuard.canActivate() de belirtilmediğinde ttl'e düşüyor, aynı
    // varsayılanı burada da elle uyguluyoruz.
    const { isBlocked } = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      TTL_MS,
      'user',
    );

    if (isBlocked) {
      throw new ThrottlerException();
    }

    return true;
  }
}
