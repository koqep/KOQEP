import { UnauthorizedException } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { TotpService } from './totp.service';
import { PrismaService } from '../db/prisma.service';

describe('TotpService', () => {
  function buildService(prismaMock: Partial<PrismaService>): TotpService {
    return new TotpService(prismaMock as PrismaService);
  }

  function liveCodeFor(secretBase32: string): string {
    const totp = new TOTP({ secret: Secret.fromBase32(secretBase32) });
    return totp.generate();
  }

  describe('generateSecret', () => {
    it('gecerli_bir_otpauth_url_uretir', () => {
      const service = buildService({});
      const { secret, otpauthUrl } = service.generateSecret('a@koqep.local');

      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(otpauthUrl).toContain('otpauth://totp/');
      expect(otpauthUrl).toContain(encodeURIComponent('a@koqep.local'));
    });
  });

  describe('confirmEnable', () => {
    it('dogru_kodla_kurtarma_kodlari_dondurur_ve_etkinlestirir', async () => {
      const secret = new Secret();
      const user = {
        id: 'user-1',
        totpSecret: secret.base32,
        totpEnabledAt: null,
      };
      const updateSpy = jest.fn().mockResolvedValue({});
      const createManySpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
          update: updateSpy,
        } as unknown as PrismaService['user'],
        totpRecoveryCode: {
          createMany: createManySpy,
        } as unknown as PrismaService['totpRecoveryCode'],
        $transaction: jest
          .fn()
          .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
      };

      const service = buildService(prismaMock);
      const code = liveCodeFor(secret.base32);
      const recoveryCodes = await service.confirmEnable('user-1', code);

      expect(recoveryCodes).toHaveLength(8);
      expect(new Set(recoveryCodes).size).toBe(8);
    });

    it('reddeder_yanlis_kodu', async () => {
      const secret = new Secret();
      const user = {
        id: 'user-1',
        totpSecret: secret.base32,
        totpEnabledAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.confirmEnable('user-1', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('reddeder_kurulum_baslatilmamissa', async () => {
      const user = { id: 'user-1', totpSecret: null, totpEnabledAt: null };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.confirmEnable('user-1', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyDuringLogin', () => {
    it('kabul_eder_canli_totp_kodunu', async () => {
      const secret = new Secret();
      const user = { id: 'user-1', totpSecret: secret.base32 };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      const code = liveCodeFor(secret.base32);

      await expect(service.verifyDuringLogin('user-1', code)).resolves.toBe(
        true,
      );
    });

    it('kabul_eder_ve_tuketir_kurtarma_kodunu_ikinci_kullanimda_reddeder', async () => {
      const secret = new Secret();
      const user = { id: 'user-1', totpSecret: secret.base32 };
      const recoveryRow = {
        id: 'rc-1',
        userId: 'user-1',
        usedAt: null as Date | null,
      };
      const findUniqueMock = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(recoveryRow.usedAt ? null : recoveryRow),
        );
      const updateManyMock = jest.fn().mockImplementation(() => {
        if (recoveryRow.usedAt) {
          return Promise.resolve({ count: 0 });
        }
        recoveryRow.usedAt = new Date();
        return Promise.resolve({ count: 1 });
      });
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        totpRecoveryCode: {
          findUnique: findUniqueMock,
          updateMany: updateManyMock,
        } as unknown as PrismaService['totpRecoveryCode'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.verifyDuringLogin('user-1', 'ABCDEF-123456'),
      ).resolves.toBe(true);
      await expect(
        service.verifyDuringLogin('user-1', 'ABCDEF-123456'),
      ).resolves.toBe(false);
    });

    it('reddeder_alakasiz_kodu', async () => {
      const secret = new Secret();
      const user = { id: 'user-1', totpSecret: secret.base32 };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        totpRecoveryCode: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['totpRecoveryCode'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.verifyDuringLogin('user-1', 'not-a-real-code'),
      ).resolves.toBe(false);
    });
  });

  describe('disable', () => {
    it('temizler_totp_alanlarini_dogru_kodla', async () => {
      const secret = new Secret();
      const user = {
        id: 'user-1',
        totpSecret: secret.base32,
        totpEnabledAt: new Date(),
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
          update: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['user'],
        totpRecoveryCode: {
          deleteMany: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['totpRecoveryCode'],
        $transaction: jest
          .fn()
          .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
      };

      const service = buildService(prismaMock);
      const code = liveCodeFor(secret.base32);

      await expect(service.disable('user-1', code)).resolves.toBeUndefined();
    });

    it('reddeder_totp_zaten_kapaliysa', async () => {
      const user = { id: 'user-1', totpSecret: null, totpEnabledAt: null };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.disable('user-1', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('isEnabled', () => {
    it('totpEnabledAt_varsa_true_doner', () => {
      const service = buildService({});
      expect(service.isEnabled({ totpEnabledAt: new Date() })).toBe(true);
      expect(service.isEnabled({ totpEnabledAt: null })).toBe(false);
    });
  });
});
