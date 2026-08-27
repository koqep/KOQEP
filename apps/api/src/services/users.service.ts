import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { INVALID_TOKEN_CODE } from './auth.service';

export interface UserProfile {
  email: string;
  username: string;
  role: UserRole;
  level: number;
  totalXp: number;
  mutedUntil: Date | null;
  muteReason: string | null;
}

// M10 Faz 2 Slice D+E: başkasının profili için PUBLIC-SAFE alan seti -
// email/mutedUntil/muteReason gibi ÖZEL alanlar (UserProfile'da) burada
// BİLEREK yok.
export interface PublicUserProfile {
  username: string;
  createdAt: Date;
  level: number;
  totalXp: number;
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
      },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: INVALID_TOKEN_CODE,
        message: 'Geçersiz veya süresi dolmuş token.',
      });
    }
    return user;
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
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return user;
  }
}
