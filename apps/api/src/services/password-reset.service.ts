import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { sha256Hex } from './crypto.util';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  constructor(private readonly prisma: PrismaService) {}

  async createResetToken(userId: string): Promise<string> {
    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('base64url');

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    return rawToken;
  }
}
