import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { sha256Hex } from './crypto.util';

const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createVerificationToken(userId: string): Promise<string> {
    const rawToken = randomBytes(VERIFICATION_TOKEN_BYTES).toString(
      'base64url',
    );

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });

    return rawToken;
  }
}
