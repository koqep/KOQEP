import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { INVALID_TOKEN_CODE } from './auth.service';
import { XP_PER_LEVEL } from './reputation.service';
import { Locale, DEFAULT_LOCALE, isValidLocale } from '../db/locale.constants';
import { USER_NOT_FOUND_CODE } from './error-codes.constants';

export interface UserProfile {
  email: string;
  username: string;
  role: UserRole;
  level: number;
  totalXp: number;
  mutedUntil: Date | null;
  muteReason: string | null;
  // M9 Slice B: HER ZAMAN çözümlenmiş/dolu (null asla dışarı sızmaz) -
  // getProfile'ın kendisi user.locale ?? DEFAULT_LOCALE'i uyguluyor, JWT'nin
  // 15dk bayatlığından BAĞIMSIZ her zaman taze.
  locale: Locale;
}

// M10 Faz 2 Slice D+E: başkasının profili için PUBLIC-SAFE alan seti -
// email/mutedUntil/muteReason gibi ÖZEL alanlar (UserProfile'da) burada
// BİLEREK yok.
export interface PublicUserProfile {
  username: string;
  createdAt: Date;
  level: number;
  totalXp: number;
  // M13 Slice E: seviye/XP çubuğu için - XP_PER_LEVEL frontend'e HİÇ
  // açılmıyor (ADR-0002: web istemcisi iş mantığı sahibi değil), yüzde
  // burada hesaplanıp gönderiliyor.
  xpProgressPercent: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        role: true,
        level: true,
        totalXp: true,
        mutedUntil: true,
        muteReason: true,
        locale: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: INVALID_TOKEN_CODE,
        message: 'Geçersiz veya süresi dolmuş token.',
      });
    }
    return {
      ...user,
      locale: isValidLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
    };
  }

  // M9 Slice B: kullanıcı ayarlardan dilini değiştirdiğinde çağrılıyor
  // (PATCH /users/me/locale, BlocksController) - login()'in TEK SEFERLİK
  // senkronundan FARKLI, burası her zaman EZER (kullanıcının kendi bilinçli
  // seçimi).
  async updateLocale(userId: string, locale: Locale): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
  }

  async getPublicProfile(username: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        createdAt: true,
        level: true,
        totalXp: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: USER_NOT_FOUND_CODE,
        message: 'Kullanıcı bulunamadı.',
      });
    }
    return {
      ...user,
      xpProgressPercent: ((user.totalXp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100,
    };
  }
}
