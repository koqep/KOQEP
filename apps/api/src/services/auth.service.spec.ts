import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { InvitesService } from './invites.service';
import { TotpService } from './totp.service';
import { PrismaService } from '../db/prisma.service';
import { DEV_USER_EMAIL } from '../db/dev-seed.constants';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  function buildService(
    prismaMock: Partial<PrismaService>,
    invitesMock: Partial<InvitesService> = {},
    totpMock: Partial<TotpService> = { isEnabled: () => false },
  ): AuthService {
    return new AuthService(
      prismaMock as PrismaService,
      jwt,
      invitesMock as InvitesService,
      totpMock as TotpService,
    );
  }

  describe('issueDevLoginToken', () => {
    it('doner_gecerli_bir_erisim_tokeni_seed_kullanici_icin', async () => {
      const seededUser = { id: 'user-1', email: DEV_USER_EMAIL };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(seededUser),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.issueDevLoginToken();

      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.sub).toBe(seededUser.id);
      expect(payload.email).toBe(seededUser.email);
    });

    it('reddeder_seed_kullanici_bulunamazsa', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.issueDevLoginToken()).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('signup', () => {
    const invite = { id: 'invite-1', code: 'ABC123', issuedById: 'root-1' };
    const dto = {
      inviteCode: 'ABC123',
      email: 'new@koqep.local',
      password: 'a-strong-password',
    };

    function buildTransactionalPrismaMock(
      updateManyResult: { count: number },
      createImpl?: () => unknown,
    ): Partial<PrismaService> {
      const txMock = {
        invite: { updateMany: jest.fn().mockResolvedValue(updateManyResult) },
        user: {
          create: createImpl
            ? jest.fn().mockImplementation(createImpl)
            : jest.fn().mockResolvedValue({}),
        },
      };
      return {
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
      };
    }

    it('doner_token_cifti_ve_daveti_talep_edileni_isaretler', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };

      const service = buildService(prismaMock, invitesMock);
      const { accessToken } = await service.signup(dto);

      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.email).toBe(dto.email);
    });

    it('reddeder_gecersiz_davet_kodunu_invites_servisine_delegasyonla', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest
          .fn()
          .mockRejectedValue(new ConflictException()),
      };

      const service = buildService(prismaMock, invitesMock);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('reddeder_yarisi_kaybedilen_davet_talebini', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 0 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };

      const service = buildService(prismaMock, invitesMock);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('reddeder_zaten_kayitli_e_postayi', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
      );
      const prismaMock = buildTransactionalPrismaMock({ count: 1 }, () => {
        throw uniqueError;
      });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };

      const service = buildService(prismaMock, invitesMock);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('doner_token_cifti_dogru_sifrede', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.login({
        email: user.email,
        password: 'correct-password',
      });

      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.sub).toBe(user.id);
    });

    it('reddeder_yanlis_sifreyi', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.login({ email: user.email, password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_bilinmeyen_e_postayi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.login({ email: 'yok@koqep.local', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    describe('TOTP etkinken', () => {
      async function buildTotpEnabledUser(): Promise<{
        user: { id: string; email: string; passwordHash: string };
        prismaMock: Partial<PrismaService>;
      }> {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
          } as unknown as PrismaService['user'],
          refreshToken: {
            create: jest.fn().mockResolvedValue({}),
          } as unknown as PrismaService['refreshToken'],
        };
        return { user, prismaMock };
      }

      it('reddeder_totp_kodu_verilmezse', async () => {
        const { prismaMock } = await buildTotpEnabledUser();
        const totpMock: Partial<TotpService> = { isEnabled: () => true };
        const service = buildService(prismaMock, {}, totpMock);

        await expect(
          service.login({
            email: 'a@koqep.local',
            password: 'correct-password',
          }),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('reddeder_gecersiz_totp_kodunu', async () => {
        const { prismaMock } = await buildTotpEnabledUser();
        const totpMock: Partial<TotpService> = {
          isEnabled: () => true,
          verifyDuringLogin: jest.fn().mockResolvedValue(false),
        };
        const service = buildService(prismaMock, {}, totpMock);

        await expect(
          service.login({
            email: 'a@koqep.local',
            password: 'correct-password',
            totpCode: '000000',
          }),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('doner_token_cifti_gecerli_totp_koduyla', async () => {
        const { user, prismaMock } = await buildTotpEnabledUser();
        const totpMock: Partial<TotpService> = {
          isEnabled: () => true,
          verifyDuringLogin: jest.fn().mockResolvedValue(true),
        };
        const service = buildService(prismaMock, {}, totpMock);

        const { accessToken } = await service.login({
          email: 'a@koqep.local',
          password: 'correct-password',
          totpCode: '123456',
        });

        const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
        expect(payload.sub).toBe(user.id);
      });
    });
  });

  describe('refresh', () => {
    it('donduren_tokeni_iptal_edip_yenisini_verir', async () => {
      const rawToken = 'a-raw-refresh-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const stored = {
        id: 'rt-1',
        tokenHash,
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const updateSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
          update: updateSpy,
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
        user: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'user-1', email: 'a@koqep.local' }),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.refresh(rawToken);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: stored.id },
        data: { revokedAt: expect.any(Date) as Date },
      });
      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.sub).toBe('user-1');
    });

    it('reddeder_iptal_edilmis_refresh_tokeni', async () => {
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);

      await expect(service.refresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('reddeder_suresi_dolmus_refresh_tokeni', async () => {
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);

      await expect(service.refresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('iptal_eder_verilen_refresh_tokeni', async () => {
      const updateManySpy = jest.fn().mockResolvedValue({ count: 1 });
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          updateMany: updateManySpy,
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);
      await service.logout('a-raw-refresh-token');

      const expectedHash = createHash('sha256')
        .update('a-raw-refresh-token')
        .digest('hex');
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { tokenHash: expectedHash, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });
});
