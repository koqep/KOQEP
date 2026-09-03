import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { sha256Hex, encryptTotpSecret, decryptTotpSecret } from './crypto.util';

const TOTP_ISSUER = 'KOQEP';
const TOTP_VALIDATION_WINDOW = 1;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 6;

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
}

@Injectable()
export class TotpService {
  constructor(private readonly prisma: PrismaService) {}

  generateSecret(email: string): TotpSetup {
    const secret = new Secret();
    const totp = new TOTP({ issuer: TOTP_ISSUER, label: email, secret });
    return { secret: secret.base32, otpauthUrl: totp.toString() };
  }

  async savePendingSecret(userId: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptTotpSecret(secret), totpEnabledAt: null },
    });
  }

  async confirmEnable(userId: string, code: string): Promise<string[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.totpSecret) {
      throw new UnauthorizedException({
        code: 'TOTP_SETUP_NOT_STARTED',
        message: 'Önce kimlik doğrulayıcı kurulumu başlatılmalı.',
      });
    }
    if (!isValidTotpCode(decryptTotpSecret(user.totpSecret), code)) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID_CODE',
        message: 'Geçersiz kimlik doğrulayıcı kodu.',
      });
    }

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpEnabledAt: new Date() },
      }),
      this.prisma.totpRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          userId,
          codeHash: sha256Hex(normalizeRecoveryCode(recoveryCode)),
        })),
      }),
    ]);

    return recoveryCodes;
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!this.isEnabled(user)) {
      throw new UnauthorizedException({
        code: 'TOTP_ALREADY_DISABLED',
        message: 'Kimlik doğrulayıcı zaten kapalı.',
      });
    }

    const valid = await this.verifyDuringLogin(userId, code);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID_CODE',
        message: 'Geçersiz kimlik doğrulayıcı kodu.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabledAt: null },
      }),
      this.prisma.totpRecoveryCode.deleteMany({ where: { userId } }),
    ]);
  }

  async verifyDuringLogin(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.totpSecret) {
      return false;
    }
    if (isValidTotpCode(decryptTotpSecret(user.totpSecret), code)) {
      return true;
    }

    return this.consumeRecoveryCode(userId, code);
  }

  isEnabled(user: { totpEnabledAt: Date | null }): boolean {
    return user.totpEnabledAt !== null;
  }

  private async consumeRecoveryCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const codeHash = sha256Hex(normalizeRecoveryCode(code));
    const match = await this.prisma.totpRecoveryCode.findUnique({
      where: { codeHash },
    });

    if (!match || match.userId !== userId || match.usedAt) {
      return false;
    }

    const claimed = await this.prisma.totpRecoveryCode.updateMany({
      where: { id: match.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    return claimed.count === 1;
  }
}

function isValidTotpCode(secretBase32: string, code: string): boolean {
  const totp = new TOTP({ secret: Secret.fromBase32(secretBase32) });
  return (
    totp.validate({ token: code, window: TOTP_VALIDATION_WINDOW }) !== null
  );
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(RECOVERY_CODE_BYTES).toString('hex');
    return `${raw.slice(0, 6)}-${raw.slice(6, 12)}`;
  });
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase();
}
