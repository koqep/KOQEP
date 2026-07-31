import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

export interface UserProfile {
  email: string;
  username: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
    }
    return user;
  }
}
