import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { InvitesService } from './invites.service';
import { TotpService } from './totp.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { SocketRegistryService } from './socket-registry.service';
import { PrismaService } from '../db/prisma.service';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  function buildService(
    prismaMock: Partial<PrismaService>,
    invitesMock: Partial<InvitesService> = {},
    totpMock: Partial<TotpService> = { isEnabled: () => false },
    passwordResetMock: Partial<PasswordResetService> = {},
    emailVerificationMock: Partial<EmailVerificationService> = {
      createVerificationToken: jest.fn().mockResolvedValue('verify-token'),
    },
    emailMock: Partial<EmailService> = {
      sendPasswordResetRequestEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordChangedNotificationEmail: jest
        .fn()
        .mockResolvedValue(undefined),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    },
    socketRegistryMock: Partial<SocketRegistryService> = {
      disconnectUser: jest.fn(),
    },
  ): AuthService {
    return new AuthService(
      prismaMock as PrismaService,
      jwt,
      invitesMock as InvitesService,
      totpMock as TotpService,
      passwordResetMock as PasswordResetService,
      emailVerificationMock as EmailVerificationService,
      emailMock as EmailService,
      socketRegistryMock as SocketRegistryService,
    );
  }

  describe('signup', () => {
    const invite = { id: 'invite-1', code: 'ABC123', issuedById: 'root-1' };
    const dto = {
      inviteCode: 'ABC123',
      email: 'new@koqep.local',
      username: 'newuser',
      password: 'a-strong-password',
      acceptedTerms: true,
    };

    function buildTransactionalPrismaMock(
      updateManyResult: { count: number },
      createImpl?: () => unknown,
      existingUsername: unknown = null,
    ): Partial<PrismaService> {
      const txMock = {
        invite: { updateMany: jest.fn().mockResolvedValue(updateManyResult) },
        user: {
          create: createImpl
            ? jest.fn().mockImplementation(createImpl)
            : jest.fn().mockResolvedValue({}),
        },
        // M7a Slice B: signup artık aynı transaction içinde çekirdek
        // odalara otomatik üyelik de yaratıyor.
        room: {
          findMany: jest.fn().mockResolvedValue([{ id: 'room-general' }]),
        },
        roomMember: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return {
        user: {
          findFirst: jest.fn().mockResolvedValue(existingUsername),
        } as unknown as PrismaService['user'],
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
      };
    }

    it('token_dondurmez_daveti_isaretler_dogrulama_e_postasi_gonderir', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };
      const emailVerificationMock: Partial<EmailVerificationService> = {
        createVerificationToken: jest.fn().mockResolvedValue('verify-token'),
      };
      const sendSpy = jest.fn().mockResolvedValue(undefined);
      const emailMock: Partial<EmailService> = {
        sendEmailVerificationEmail: sendSpy,
      };

      const service = buildService(
        prismaMock,
        invitesMock,
        undefined,
        undefined,
        emailVerificationMock,
        emailMock,
      );
      const result = await service.signup(dto);

      expect(result).toBeUndefined();
      expect(sendSpy).toHaveBeenCalledWith(
        dto.email,
        expect.stringContaining('verify-token') as string,
      );
    });

    it('e_posta_gonderim_hatasini_yutmaz_firlatir', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };
      const emailMock: Partial<EmailService> = {
        sendEmailVerificationEmail: jest
          .fn()
          .mockRejectedValue(new Error('resend patladı')),
      };

      const service = buildService(
        prismaMock,
        invitesMock,
        undefined,
        undefined,
        undefined,
        emailMock,
      );

      await expect(service.signup(dto)).rejects.toThrow('resend patladı');
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

    it('reddeder_zaten_kayitli_kullanici_adini_yarisi_durumunda', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['username'] },
        },
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

    it('reddeder_buyuk_kucuk_harf_farkli_ama_ayni_kullanici_adini_on_kontrolde', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 }, undefined, {
        id: 'existing-user',
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
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        passwordHash,
        emailVerifiedAt: new Date(),
      };
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
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
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

    it('reddeder_dogrulanmamis_e_postayi', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        passwordHash,
        emailVerifiedAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.login({ email: user.email, password: 'correct-password' }),
      ).rejects.toMatchObject({
        response: { code: 'EMAIL_NOT_VERIFIED' },
      });
    });

    describe('TOTP etkinken', () => {
      async function buildTotpEnabledUser(): Promise<{
        user: { id: string; email: string; passwordHash: string };
        prismaMock: Partial<PrismaService>;
      }> {
        const passwordHash = await argon2.hash('correct-password');
        const user = {
          id: 'user-1',
          email: 'a@koqep.local',
          passwordHash,
          emailVerifiedAt: new Date(),
        };
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
        ).rejects.toMatchObject({
          response: { code: 'TOTP_REQUIRED' },
        });
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
        data: { revokedAt: expect.any(Date) as Date, revokedByRotation: true },
      });
      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.sub).toBe('user-1');
    });

    it('reddeder_grace_penceresi_gecmis_iptal_edilmis_refresh_tokeni', async () => {
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        // Grace penceresi 10sn - 60sn önce iptal edilmiş bir token artık
        // kesin reddedilmeli.
        revokedAt: new Date(Date.now() - 60 * 1000),
        revokedByRotation: true,
        graceReusedAt: null,
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

    it('reddeder_logoutla_iptal_edilmis_tokeni_grace_penceresi_icinde_bile', async () => {
      // M7a Slice A'nın gerçek e2e testinde bulunan bir bug'ın regresyon
      // testi: grace toleransı SADECE rotasyon-kaynaklı revoke'lara
      // uygulanmalı - logout'un (revokedByRotation:false) ANINDA/kesin
      // iptali grace penceresi içinde bile ASLA tolere edilmemeli, yoksa
      // "çıkış yaptım" ama token birkaç saniye daha çalışıyor olurdu.
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        revokedAt: new Date(Date.now() - 1000),
        revokedByRotation: false,
        graceReusedAt: null,
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

    it('grace_penceresi_icinde_iptal_edilmis_tokeni_bir_kez_kabul_eder_ve_isaretler', async () => {
      // M7a Slice A: çoklu-sekme yarışı - sekme A rotasyon yaptıktan hemen
      // sonra sekme B AYNI (artık revoke edilmiş) token'la gelirse, grace
      // penceresi içinde reddedilmek yerine bir kez daha kabul edilir.
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        revokedAt: new Date(Date.now() - 2000),
        revokedByRotation: true,
        graceReusedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const updateManySpy = jest.fn().mockResolvedValue({ count: 1 });
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
          updateMany: updateManySpy,
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
        user: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'user-1', email: 'a@koqep.local' }),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.refresh('token');

      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: stored.id, graceReusedAt: null },
        data: { graceReusedAt: expect.any(Date) as Date },
      });
      const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
      expect(payload.sub).toBe('user-1');
    });

    it('reddeder_grace_hakki_zaten_harcanmis_tokeni', async () => {
      const stored = {
        id: 'rt-1',
        tokenHash: 'x',
        userId: 'user-1',
        revokedAt: new Date(Date.now() - 2000),
        revokedByRotation: true,
        graceReusedAt: new Date(Date.now() - 1000),
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

  describe('deleteAccount', () => {
    it('siler_dogru_sifreyle', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const deleteSpy = jest.fn().mockResolvedValue(user);
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          delete: deleteSpy,
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      await service.deleteAccount('user-1', 'correct-password');

      expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('silme_basarili_olunca_kullanicinin_soketlerini_koparir', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          delete: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };
      const disconnectUserSpy = jest.fn();
      const socketRegistryMock: Partial<SocketRegistryService> = {
        disconnectUser: disconnectUserSpy,
      };

      const service = buildService(
        prismaMock,
        {},
        undefined,
        {},
        undefined,
        undefined,
        socketRegistryMock,
      );
      await service.deleteAccount('user-1', 'correct-password');

      expect(disconnectUserSpy).toHaveBeenCalledWith('user-1');
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
        service.deleteAccount('user-1', 'wrong'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('reddeder_bulunamayan_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.deleteAccount('yok-1', 'x')).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    describe('TOTP etkinken', () => {
      it('reddeder_totp_kodu_verilmezse', async () => {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
          } as unknown as PrismaService['user'],
        };
        const totpMock: Partial<TotpService> = { isEnabled: () => true };
        const service = buildService(prismaMock, {}, totpMock);

        await expect(
          service.deleteAccount('user-1', 'correct-password'),
        ).rejects.toMatchObject({
          response: { code: 'TOTP_REQUIRED' },
        });
      });

      it('siler_gecerli_totp_koduyla', async () => {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const deleteSpy = jest.fn().mockResolvedValue(user);
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            delete: deleteSpy,
          } as unknown as PrismaService['user'],
        };
        const totpMock: Partial<TotpService> = {
          isEnabled: () => true,
          verifyDuringLogin: jest.fn().mockResolvedValue(true),
        };
        const service = buildService(prismaMock, {}, totpMock);

        await service.deleteAccount('user-1', 'correct-password', '123456');

        expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      });
    });

    it('reddeder_p2025_yarisinda_temiz_401le', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const p2025 = new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: 'test',
      });
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          delete: jest.fn().mockRejectedValue(p2025),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.deleteAccount('user-1', 'correct-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('requestPasswordReset', () => {
    it('bulunan_kullanici_icin_token_uretir_ve_e_posta_gonderir', async () => {
      const user = { id: 'user-1', email: 'a@koqep.local' };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };
      const passwordResetMock: Partial<PasswordResetService> = {
        createResetToken: jest.fn().mockResolvedValue('raw-token'),
      };
      const sendSpy = jest.fn().mockResolvedValue(undefined);
      const emailMock: Partial<EmailService> = {
        sendPasswordResetRequestEmail: sendSpy,
      };

      const service = buildService(
        prismaMock,
        {},
        { isEnabled: () => false },
        passwordResetMock,
        {},
        emailMock,
      );
      await service.requestPasswordReset('a@koqep.local');

      expect(passwordResetMock.createResetToken).toHaveBeenCalledWith('user-1');
      expect(sendSpy).toHaveBeenCalledWith(
        'a@koqep.local',
        expect.stringContaining('raw-token') as string,
      );
    });

    it('bulunamayan_kullanici_icin_hata_firlatmaz_ve_e_posta_gondermez', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const sendSpy = jest.fn();
      const emailMock: Partial<EmailService> = {
        sendPasswordResetRequestEmail: sendSpy,
      };

      const service = buildService(
        prismaMock,
        {},
        { isEnabled: () => false },
        {},
        {},
        emailMock,
      );

      await expect(
        service.requestPasswordReset('yok@koqep.local'),
      ).resolves.toBeUndefined();
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('e_posta_gonderim_hatasini_yutar_firlatmaz', async () => {
      const user = { id: 'user-1', email: 'a@koqep.local' };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };
      const passwordResetMock: Partial<PasswordResetService> = {
        createResetToken: jest.fn().mockResolvedValue('raw-token'),
      };
      const emailMock: Partial<EmailService> = {
        sendPasswordResetRequestEmail: jest
          .fn()
          .mockRejectedValue(new Error('resend patladı')),
      };

      const service = buildService(
        prismaMock,
        {},
        { isEnabled: () => false },
        passwordResetMock,
        {},
        emailMock,
      );

      await expect(
        service.requestPasswordReset('a@koqep.local'),
      ).resolves.toBeUndefined();
    });
  });

  describe('confirmPasswordReset', () => {
    function buildTransactionalPrismaMock(updateManyResult: {
      count: number;
    }): {
      prismaMock: Partial<PrismaService>;
      userUpdateSpy: jest.Mock;
      refreshRevokeSpy: jest.Mock;
    } {
      const userUpdateSpy = jest.fn().mockResolvedValue({});
      const refreshRevokeSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        passwordResetToken: {
          updateMany: jest.fn().mockResolvedValue(updateManyResult),
        },
        user: { update: userUpdateSpy },
        refreshToken: { updateMany: refreshRevokeSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
        user: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'user-1', email: 'a@koqep.local' }),
        } as unknown as PrismaService['user'],
      };
      return { prismaMock, userUpdateSpy, refreshRevokeSpy };
    }

    it('gecerli_tokenle_sifreyi_gunceller_ve_oturumlari_iptal_eder', async () => {
      const stored = {
        id: 'prt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const { prismaMock, userUpdateSpy, refreshRevokeSpy } =
        buildTransactionalPrismaMock({ count: 1 });
      (
        prismaMock as unknown as {
          passwordResetToken: { findUnique: jest.Mock };
        }
      ).passwordResetToken = {
        findUnique: jest.fn().mockResolvedValue(stored),
      };

      const service = buildService(prismaMock);
      await service.confirmPasswordReset('raw-token', 'a-new-password');

      expect(userUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(refreshRevokeSpy).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('reddeder_bulunamayan_tokeni', async () => {
      const prismaMock: Partial<PrismaService> = {
        passwordResetToken: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['passwordResetToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmPasswordReset('raw-token', 'a-new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_kullanilmis_tokeni', async () => {
      const stored = {
        id: 'prt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const prismaMock: Partial<PrismaService> = {
        passwordResetToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['passwordResetToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmPasswordReset('raw-token', 'a-new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_suresi_dolmus_tokeni', async () => {
      const stored = {
        id: 'prt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };
      const prismaMock: Partial<PrismaService> = {
        passwordResetToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['passwordResetToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmPasswordReset('raw-token', 'a-new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_yarisi_kaybedilen_talebi', async () => {
      const stored = {
        id: 'prt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const { prismaMock } = buildTransactionalPrismaMock({ count: 0 });
      (
        prismaMock as unknown as {
          passwordResetToken: { findUnique: jest.Mock };
        }
      ).passwordResetToken = {
        findUnique: jest.fn().mockResolvedValue(stored),
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmPasswordReset('raw-token', 'a-new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('confirmEmailVerification', () => {
    function buildTransactionalPrismaMock(updateManyResult: {
      count: number;
    }): {
      prismaMock: Partial<PrismaService>;
      userUpdateSpy: jest.Mock;
    } {
      const userUpdateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        emailVerificationToken: {
          updateMany: jest.fn().mockResolvedValue(updateManyResult),
        },
        user: { update: userUpdateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      return { prismaMock, userUpdateSpy };
    }

    it('gecerli_tokenle_emailVerifiedAt_alanini_gunceller', async () => {
      const stored = {
        id: 'evt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const { prismaMock, userUpdateSpy } = buildTransactionalPrismaMock({
        count: 1,
      });
      (
        prismaMock as unknown as {
          emailVerificationToken: { findUnique: jest.Mock };
        }
      ).emailVerificationToken = {
        findUnique: jest.fn().mockResolvedValue(stored),
      };

      const service = buildService(prismaMock);
      await service.confirmEmailVerification('raw-token');

      expect(userUpdateSpy).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerifiedAt: expect.any(Date) as Date },
      });
    });

    it('reddeder_bulunamayan_tokeni', async () => {
      const prismaMock: Partial<PrismaService> = {
        emailVerificationToken: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['emailVerificationToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmEmailVerification('raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_kullanilmis_tokeni', async () => {
      const stored = {
        id: 'evt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const prismaMock: Partial<PrismaService> = {
        emailVerificationToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['emailVerificationToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmEmailVerification('raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_suresi_dolmus_tokeni', async () => {
      const stored = {
        id: 'evt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };
      const prismaMock: Partial<PrismaService> = {
        emailVerificationToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['emailVerificationToken'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmEmailVerification('raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('reddeder_yarisi_kaybedilen_talebi', async () => {
      const stored = {
        id: 'evt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const { prismaMock } = buildTransactionalPrismaMock({ count: 0 });
      (
        prismaMock as unknown as {
          emailVerificationToken: { findUnique: jest.Mock };
        }
      ).emailVerificationToken = {
        findUnique: jest.fn().mockResolvedValue(stored),
      };

      const service = buildService(prismaMock);

      await expect(
        service.confirmEmailVerification('raw-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
