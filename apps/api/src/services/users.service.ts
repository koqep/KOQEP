import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

export interface UserProfile {
  email: string;
  username: string;
  role: UserRole;
  level: number;
  totalXp: number;
  mutedUntil: Date | null;
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
      },
    });
    if (!user) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
    }
    return user;
  }
}
