import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { DEV_USER_EMAIL } from '../db/dev-seed.constants';
import { InvitesService } from './invites.service';
import { SignupDto } from '../api/dto/signup.dto';
import { LoginDto } from '../api/dto/login.dto';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly invitesService: InvitesService,
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

  async signup(dto: SignupDto): Promise<TokenPair> {
    const invite = await this.invitesService.findRedeemableInvite(
      dto.inviteCode,
    );
    const passwordHash = await argon2.hash(dto.password);
    const userId = randomUUID();

    try {
      await this.prisma.$transaction(async (tx) => {
        // Sıra önemli: usedById FK'si var olan bir User satırını işaret
        // etmeli, o yüzden önce User oluşturulur, davet sonra "claim" edilir.
        // İkisi de aynı transaction'da — claim kaybedilirse (count===0)
        // User da birlikte geri alınır, yetim hesap kalmaz.
        await tx.user.create({
          data: {
            id: userId,
            email: dto.email,
            passwordHash,
            inviterId: invite.issuedById,
          },
        });

        const claimed = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedById: userId, usedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new ConflictException('Bu davet kodu zaten kullanılmış.');
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Bu e-posta zaten kayıtlı.');
      }
      throw error;
    }

    return this.issueTokenPair(userId, dto.email);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const isValid = user
      ? await verifyPasswordSafely(user.passwordHash, dto.password)
      : false;

    if (!user || !isValid) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    return this.issueTokenPair(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    return this.issueTokenPair(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function verifyPasswordSafely(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}
