import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../db/prisma.service';
import { DEV_USER_EMAIL } from '../db/dev-seed.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issueDevLoginToken(): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: DEV_USER_EMAIL },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Seeded dev kullanıcı bulunamadı — önce `npm run db:seed` çalıştırılmalı.',
      );
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { accessToken };
  }

  async verifyAccessToken(
    token: string,
  ): Promise<{ sub: string; email: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
    }
  }
}
