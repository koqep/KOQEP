import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { AUTHOR_DELETED_CONTENT } from './messages.service';
import { InvitesService } from './invites.service';
import { TotpService } from './totp.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { SocketRegistryService } from './socket-registry.service';
import { PasswordPolicyService } from './password-policy.service';
import { PrismaService } from '../db/prisma.service';
import {
  INVITE_NO_LONGER_VALID_CODE,
  INVALID_REFRESH_TOKEN_CODE,
} from './error-codes.constants';

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
      sendAccountLockedNotificationEmail: jest
        .fn()
        .mockResolvedValue(undefined),
    },
    socketRegistryMock: Partial<SocketRegistryService> = {
      disconnectUser: jest.fn(),
    },
    passwordPolicyMock: Partial<PasswordPolicyService> = {
      assertNotBreached: jest.fn().mockResolvedValue(undefined),
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
      passwordPolicyMock as PasswordPolicyService,
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

    it('reddeder_bilinen_sizdirilmis_sifreyi', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };
      const passwordPolicyMock: Partial<PasswordPolicyService> = {
        assertNotBreached: jest.fn().mockRejectedValue(
          new BadRequestException({
            code: 'PASSWORD_BREACHED',
            message:
              'Bu şifre bilinen bir veri sızıntısında bulunmuş, başka bir şifre seç.',
          }),
        ),
      };

      const service = buildService(
        prismaMock,
        invitesMock,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        passwordPolicyMock,
      );

      await expect(service.signup(dto)).rejects.toMatchObject({
        response: { code: 'PASSWORD_BREACHED' },
      });
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

      await expect(service.signup(dto)).rejects.toMatchObject({
        response: { code: INVITE_NO_LONGER_VALID_CODE },
      });
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

      await expect(service.signup(dto)).rejects.toMatchObject({
        response: { code: 'EMAIL_TAKEN' },
      });
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

      await expect(service.signup(dto)).rejects.toMatchObject({
        response: { code: 'USERNAME_TAKEN' },
      });
    });

    it('reddeder_buyuk_kucuk_harf_farkli_ama_ayni_kullanici_adini_on_kontrolde', async () => {
      const prismaMock = buildTransactionalPrismaMock({ count: 1 }, undefined, {
        id: 'existing-user',
      });
      const invitesMock: Partial<InvitesService> = {
        findRedeemableInvite: jest.fn().mockResolvedValue(invite),
      };

      const service = buildService(prismaMock, invitesMock);

      await expect(service.signup(dto)).rejects.toMatchObject({
        response: { code: 'USERNAME_TAKEN' },
      });
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

    // M9 Slice B: kod tabanına eklenen locale-senkron mantığı.
    it('locale_null_iken_localehint_senkronlanir_ve_jwte_yazilir', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        passwordHash,
        emailVerifiedAt: new Date(),
        locale: null,
        failedLoginCount: 0,
        lockedUntil: null,
      };
      const updateSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          update: updateSpy,
        } as unknown as PrismaService['user'],
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.login({
        email: user.email,
        password: 'correct-password',
        localeHint: 'tr',
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { locale: 'tr' },
      });
      const payload = jwt.verify<{ sub: string; locale: string }>(accessToken);
      expect(payload.locale).toBe('tr');
    });

    it('locale_zaten_doluyken_localehint_yok_sayilir', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        passwordHash,
        emailVerifiedAt: new Date(),
        locale: 'tr',
        failedLoginCount: 0,
        lockedUntil: null,
      };
      const updateSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          update: updateSpy,
        } as unknown as PrismaService['user'],
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.login({
        email: user.email,
        password: 'correct-password',
        localeHint: 'en',
      });

      expect(updateSpy).not.toHaveBeenCalled();
      const payload = jwt.verify<{ sub: string; locale: string }>(accessToken);
      expect(payload.locale).toBe('tr');
    });

    it('reddeder_yanlis_sifreyi', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        lockoutNotifiedAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          update: jest.fn().mockResolvedValue({}),
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

    // M7a Slice F: isCurrentlyLocked/computeNextLockoutState/
    // shouldSendLockoutNotification EXPORT EDİLMİYOR (verifyPasswordSafely/
    // isUniqueConstraintError'ın AYNI, bu dosyanın zaten kurulu deseni) -
    // login()'in gözlemlenebilir davranışı üzerinden DOLAYLI test ediliyor.
    describe('hesap kilidi (brute-force)', () => {
      async function buildUser(
        overrides: Partial<{
          failedLoginCount: number;
          lockedUntil: Date | null;
          lockoutNotifiedAt: Date | null;
        }> = {},
      ): Promise<{
        id: string;
        email: string;
        passwordHash: string;
        emailVerifiedAt: Date;
        failedLoginCount: number;
        lockedUntil: Date | null;
        lockoutNotifiedAt: Date | null;
      }> {
        const passwordHash = await argon2.hash('correct-password');
        return {
          id: 'user-1',
          email: 'a@koqep.local',
          passwordHash,
          emailVerifiedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          lockoutNotifiedAt: null,
          ...overrides,
        };
      }

      it('esikteki_yanlis_sifre_kilitler_ve_bildirimi_yaniti_beklemeden_ateşler', async () => {
        const user = await buildUser({ failedLoginCount: 4 });
        const updateMock = jest.fn().mockResolvedValue({});
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: updateMock,
          } as unknown as PrismaService['user'],
        };
        let resolveEmail: () => void = () => {};
        const emailPromise = new Promise<void>((resolve) => {
          resolveEmail = resolve;
        });
        const sendLockEmailMock = jest.fn().mockReturnValue(emailPromise);
        const emailMock: Partial<EmailService> = {
          sendAccountLockedNotificationEmail: sendLockEmailMock,
        };
        const service = buildService(
          prismaMock,
          {},
          undefined,
          {},
          undefined,
          emailMock,
        );

        // login() e-posta promise'i HİÇ resolve edilmeden reddediyor -
        // await edilmediğinin deterministik kanıtı (wall-clock ölçümü
        // DEĞİL, kullanıcının review'ında önerilen teknik).
        await expect(
          service.login({ email: user.email, password: 'wrong' }),
        ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });

        expect(updateMock).toHaveBeenCalledWith({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: expect.any(Date) as Date,
          },
        });
        expect(sendLockEmailMock).toHaveBeenCalledWith(user.email);
        resolveEmail();
      });

      it('kilitliyken_dogru_sifreyle_bile_ayni_invalid_credentials_ile_reddeder', async () => {
        const user = await buildUser({
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
        });
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
          } as unknown as PrismaService['user'],
        };
        const service = buildService(prismaMock);

        await expect(
          service.login({ email: user.email, password: 'correct-password' }),
        ).rejects.toMatchObject({
          response: {
            code: 'INVALID_CREDENTIALS',
            message: 'E-posta veya şifre hatalı.',
          },
        });
      });

      it('dogru_sifreyle_basarili_giris_kilit_sayacini_sifirlar', async () => {
        const user = await buildUser({ failedLoginCount: 3 });
        const updateMock = jest.fn().mockResolvedValue({});
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: updateMock,
          } as unknown as PrismaService['user'],
          refreshToken: {
            create: jest.fn().mockResolvedValue({}),
          } as unknown as PrismaService['refreshToken'],
        };
        const service = buildService(prismaMock);

        await service.login({
          email: user.email,
          password: 'correct-password',
        });

        expect(updateMock).toHaveBeenCalledWith({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null },
        });
      });

      it('yanlis_totp_kodu_kilit_sayacini_hic_etkilemez', async () => {
        const user = await buildUser();
        const updateMock = jest.fn().mockResolvedValue({});
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: updateMock,
          } as unknown as PrismaService['user'],
        };
        const totpMock: Partial<TotpService> = {
          isEnabled: () => true,
          verifyDuringLogin: jest.fn().mockResolvedValue(false),
        };
        const service = buildService(prismaMock, {}, totpMock);

        await expect(
          service.login({
            email: user.email,
            password: 'correct-password',
            totpCode: '000000',
          }),
        ).rejects.toMatchObject({ response: { code: 'TOTP_REQUIRED' } });

        // Şifre zaten doğruydu - başarılı-giriş sıfırlama dalı çalışır
        // (failedLoginCount zaten 0 olduğu için update ÇAĞRILMAZ), ama
        // ÖNEMLİ olan: hiçbir çağrı failedLoginCount'u ARTIRMAZ.
        expect(updateMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              failedLoginCount: expect.any(Number) as number,
            }) as unknown,
          }),
        );
      });

      it('soguma_penceresi_icindeyken_ikinci_kilit_bildirim_gondermez', async () => {
        const user = await buildUser({
          failedLoginCount: 4,
          lockoutNotifiedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 saat önce
        });
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: jest.fn().mockResolvedValue({}),
          } as unknown as PrismaService['user'],
        };
        const sendLockEmailMock = jest.fn().mockResolvedValue(undefined);
        const emailMock: Partial<EmailService> = {
          sendAccountLockedNotificationEmail: sendLockEmailMock,
        };
        const service = buildService(
          prismaMock,
          {},
          undefined,
          {},
          undefined,
          emailMock,
        );

        await expect(
          service.login({ email: user.email, password: 'wrong' }),
        ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });

        expect(sendLockEmailMock).not.toHaveBeenCalled();
      });

      it('soguma_penceresi_gectikten_sonra_ikinci_kilit_bildirim_gonderir', async () => {
        const user = await buildUser({
          failedLoginCount: 4,
          lockoutNotifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), // 13 saat önce
        });
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: jest.fn().mockResolvedValue({}),
          } as unknown as PrismaService['user'],
        };
        const sendLockEmailMock = jest.fn().mockResolvedValue(undefined);
        const emailMock: Partial<EmailService> = {
          sendAccountLockedNotificationEmail: sendLockEmailMock,
        };
        const service = buildService(
          prismaMock,
          {},
          undefined,
          {},
          undefined,
          emailMock,
        );

        await expect(
          service.login({ email: user.email, password: 'wrong' }),
        ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });

        expect(sendLockEmailMock).toHaveBeenCalledWith(user.email);
      });

      it('bildirim_gonderimi_basarisiz_olursa_lockoutNotifiedAt_guncellenmez', async () => {
        const user = await buildUser({ failedLoginCount: 4 });
        const updateMock = jest.fn().mockResolvedValue({});
        const prismaMock: Partial<PrismaService> = {
          user: {
            findUnique: jest.fn().mockResolvedValue(user),
            update: updateMock,
          } as unknown as PrismaService['user'],
        };
        const sendLockEmailMock = jest
          .fn()
          .mockRejectedValue(new Error('resend patladı'));
        const emailMock: Partial<EmailService> = {
          sendAccountLockedNotificationEmail: sendLockEmailMock,
        };
        const service = buildService(
          prismaMock,
          {},
          undefined,
          {},
          undefined,
          emailMock,
        );

        await expect(
          service.login({ email: user.email, password: 'wrong' }),
        ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });

        // Fire-and-forget task'ın kendi mikro-görev kuyruğunda tamamlanmasını
        // bekle - login() zaten dönmüş olsa da sendLockoutNotification hâlâ
        // çalışıyor olabilir.
        await new Promise((resolve) => setImmediate(resolve));

        expect(updateMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              lockoutNotifiedAt: expect.any(Date) as Date,
            }) as unknown,
          }),
        );
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

    // M9 Slice B: refresh de login gibi user.locale'i (varsa) JWT'ye taşır.
    it('jwt_payloadina_user_locale_i_yazar', async () => {
      const rawToken = 'a-raw-refresh-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const stored = {
        id: 'rt-1',
        tokenHash,
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const prismaMock: Partial<PrismaService> = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['refreshToken'],
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            locale: 'tr',
          }),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);
      const { accessToken } = await service.refresh(rawToken);

      const payload = jwt.verify<{ sub: string; locale: string }>(accessToken);
      expect(payload.locale).toBe('tr');
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

      await expect(service.refresh('token')).rejects.toMatchObject({
        response: { code: INVALID_REFRESH_TOKEN_CODE },
      });
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

      await expect(service.refresh('token')).rejects.toMatchObject({
        response: { code: INVALID_REFRESH_TOKEN_CODE },
      });
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

      await expect(service.refresh('token')).rejects.toMatchObject({
        response: { code: INVALID_REFRESH_TOKEN_CODE },
      });
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

      await expect(service.refresh('token')).rejects.toMatchObject({
        response: { code: INVALID_REFRESH_TOKEN_CODE },
      });
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

  // M7a Slice C: deleteAccount'ın kendi reauth mantığından çıkarılan
  // metod - moderator-role.service.ts'in assignModerator'ı da bunu
  // kullanıyor. deleteAccount'un kendi test bloğu bu mantığı DOLAYLI
  // olarak zaten kapsıyor (refactor davranışı değiştirmedi) - bu blok
  // DOĞRUDAN, metodun kendi sözleşmesi için.
  describe('verifyCurrentPassword', () => {
    it('gecer_dogru_sifreyle', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };
      const service = buildService(prismaMock);

      await expect(
        service.verifyCurrentPassword('user-1', 'correct-password'),
      ).resolves.toBeUndefined();
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
        service.verifyCurrentPassword('user-1', 'wrong'),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    });

    it('reddeder_bulunamayan_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const service = buildService(prismaMock);

      await expect(
        service.verifyCurrentPassword('yok-1', 'x'),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    });

    it('totp_acikken_kod_eksikse_reddeder', async () => {
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
        service.verifyCurrentPassword('user-1', 'correct-password'),
      ).rejects.toMatchObject({ response: { code: 'TOTP_REQUIRED' } });
    });

    it('totp_acikken_gecerli_kodla_gecer', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
      };
      const totpMock: Partial<TotpService> = {
        isEnabled: () => true,
        verifyDuringLogin: jest.fn().mockResolvedValue(true),
      };
      const service = buildService(prismaMock, {}, totpMock);

      await expect(
        service.verifyCurrentPassword('user-1', 'correct-password', '123456'),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteAccount', () => {
    // M6c Slice B: deleteAccount artık user.delete'i $transaction içinde
    // (redactMessageContent varsa önce mesaj/edit/rapor updateMany'leri,
    // sonra user.delete) çağırıyor - messages.service.spec.ts'in editMessage
    // testlerindeki AYNI $transaction mock deseni.
    function buildDeleteAccountPrismaMock(
      user: { id: string; email: string; passwordHash: string } | null,
      overrides: {
        userDelete?: jest.Mock;
        messageFindMany?: jest.Mock;
        messageEditFindMany?: jest.Mock;
        reportFindMany?: jest.Mock;
      } = {},
    ) {
      const userDeleteSpy =
        overrides.userDelete ?? jest.fn().mockResolvedValue(user);
      const messageFindManySpy =
        overrides.messageFindMany ?? jest.fn().mockResolvedValue([]);
      const messageUpdateManySpy = jest.fn().mockResolvedValue({ count: 0 });
      const messageEditFindManySpy =
        overrides.messageEditFindMany ?? jest.fn().mockResolvedValue([]);
      const messageEditUpdateManySpy = jest
        .fn()
        .mockResolvedValue({ count: 0 });
      const reportFindManySpy =
        overrides.reportFindMany ?? jest.fn().mockResolvedValue([]);
      const reportUpdateManySpy = jest.fn().mockResolvedValue({ count: 0 });
      const txMock = {
        user: { delete: userDeleteSpy },
        message: {
          findMany: messageFindManySpy,
          updateMany: messageUpdateManySpy,
        },
        messageEdit: {
          findMany: messageEditFindManySpy,
          updateMany: messageEditUpdateManySpy,
        },
        report: {
          findMany: reportFindManySpy,
          updateMany: reportUpdateManySpy,
        },
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      return {
        prismaMock,
        userDeleteSpy,
        messageFindManySpy,
        messageUpdateManySpy,
        messageEditFindManySpy,
        messageEditUpdateManySpy,
        reportFindManySpy,
        reportUpdateManySpy,
      };
    }

    it('siler_dogru_sifreyle', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const { prismaMock, userDeleteSpy } = buildDeleteAccountPrismaMock(user);

      const service = buildService(prismaMock);
      await service.deleteAccount('user-1', 'correct-password');

      expect(userDeleteSpy).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('silme_basarili_olunca_kullanicinin_soketlerini_koparir', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const { prismaMock } = buildDeleteAccountPrismaMock(user);
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
        const { prismaMock, userDeleteSpy } =
          buildDeleteAccountPrismaMock(user);
        const totpMock: Partial<TotpService> = {
          isEnabled: () => true,
          verifyDuringLogin: jest.fn().mockResolvedValue(true),
        };
        const service = buildService(prismaMock, {}, totpMock);

        await service.deleteAccount('user-1', 'correct-password', '123456');

        expect(userDeleteSpy).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      });
    });

    it('reddeder_p2025_yarisinda_temiz_401le', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
      const p2025 = new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: 'test',
      });
      const { prismaMock } = buildDeleteAccountPrismaMock(user, {
        userDelete: jest.fn().mockRejectedValue(p2025),
      });

      const service = buildService(prismaMock);

      await expect(
        service.deleteAccount('user-1', 'correct-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    describe('redactMessageContent', () => {
      it('true_iken_mesajlarini_gecmisini_ve_rapor_snapshotlarini_redakte_eder', async () => {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const {
          prismaMock,
          messageFindManySpy,
          messageUpdateManySpy,
          messageEditUpdateManySpy,
          reportUpdateManySpy,
          userDeleteSpy,
        } = buildDeleteAccountPrismaMock(user, {
          messageFindMany: jest.fn().mockResolvedValue([
            { id: 'msg-1', content: 'ilk mesaj' },
            { id: 'msg-2', content: 'ikinci mesaj' },
          ]),
        });

        const service = buildService(prismaMock);
        await service.deleteAccount(
          'user-1',
          'correct-password',
          undefined,
          true,
        );

        expect(messageFindManySpy).toHaveBeenCalledWith({
          where: { authorId: 'user-1' },
          select: { id: true, content: true },
        });
        expect(messageUpdateManySpy).toHaveBeenCalledWith({
          where: { id: { in: ['msg-1', 'msg-2'] } },
          data: { content: AUTHOR_DELETED_CONTENT },
        });
        expect(messageEditUpdateManySpy).toHaveBeenCalledWith({
          where: { messageId: { in: ['msg-1', 'msg-2'] } },
          data: { previousContent: AUTHOR_DELETED_CONTENT },
        });
        expect(reportUpdateManySpy).toHaveBeenCalledWith({
          where: { messageId: { in: ['msg-1', 'msg-2'] } },
          data: { reportedContent: AUTHOR_DELETED_CONTENT },
        });
        expect(userDeleteSpy).toHaveBeenCalledWith({
          where: { id: 'user-1' },
        });
      });

      it('false_ya_da_belirtilmemisken_ve_pii_yoksa_hicbir_redaksiyon_yapmaz', async () => {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const { prismaMock, messageFindManySpy, messageUpdateManySpy } =
          buildDeleteAccountPrismaMock(user, {
            messageFindMany: jest
              .fn()
              .mockResolvedValue([{ id: 'msg-1', content: 'sıradan mesaj' }]),
          });

        const service = buildService(prismaMock);
        await service.deleteAccount('user-1', 'correct-password');

        // M6c Slice C: mesajlar HER ZAMAN çekiliyor (dar tarama için) ama
        // yapısal PII yoksa updateMany hiç çağrılmıyor.
        expect(messageFindManySpy).toHaveBeenCalled();
        expect(messageUpdateManySpy).not.toHaveBeenCalled();
      });

      describe('dar otomatik tarama (redactMessageContent false/belirtilmemişken)', () => {
        it('yapisal_pii_iceren_mesaji_redakte_eder_temiz_olana_dokunmaz', async () => {
          const passwordHash = await argon2.hash('correct-password');
          const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
          const { prismaMock, messageUpdateManySpy } =
            buildDeleteAccountPrismaMock(user, {
              messageFindMany: jest.fn().mockResolvedValue([
                { id: 'msg-kirli', content: 'ben Ahmet, ahmet@ornek.com' },
                { id: 'msg-temiz', content: 'sıradan bir mesaj' },
              ]),
            });

          const service = buildService(prismaMock);
          await service.deleteAccount('user-1', 'correct-password');

          expect(messageUpdateManySpy).toHaveBeenCalledWith({
            where: { id: { in: ['msg-kirli'] } },
            data: { content: AUTHOR_DELETED_CONTENT },
          });
        });

        it('mesaj_temiz_ama_gecmisi_pii_iceriyorsa_sadece_o_edit_satirini_redakte_eder', async () => {
          const passwordHash = await argon2.hash('correct-password');
          const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
          const { prismaMock, messageUpdateManySpy, messageEditUpdateManySpy } =
            buildDeleteAccountPrismaMock(user, {
              messageFindMany: jest
                .fn()
                .mockResolvedValue([
                  { id: 'msg-1', content: 'düzenlenmiş, artık temiz' },
                ]),
              messageEditFindMany: jest.fn().mockResolvedValue([
                {
                  id: 'edit-1',
                  previousContent: 'ben Ahmet, 0555 123 45 67',
                },
              ]),
            });

          const service = buildService(prismaMock);
          await service.deleteAccount('user-1', 'correct-password');

          expect(messageUpdateManySpy).not.toHaveBeenCalled();
          expect(messageEditUpdateManySpy).toHaveBeenCalledWith({
            where: { id: { in: ['edit-1'] } },
            data: { previousContent: AUTHOR_DELETED_CONTENT },
          });
        });

        it('rapor_snapshotu_pii_iceriyorsa_sadece_o_rapor_satirini_redakte_eder', async () => {
          const passwordHash = await argon2.hash('correct-password');
          const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
          const { prismaMock, reportUpdateManySpy } =
            buildDeleteAccountPrismaMock(user, {
              messageFindMany: jest
                .fn()
                .mockResolvedValue([{ id: 'msg-1', content: 'sıradan mesaj' }]),
              reportFindMany: jest
                .fn()
                .mockResolvedValue([
                  { id: 'report-1', reportedContent: 'iletisim@ornek.com' },
                ]),
            });

          const service = buildService(prismaMock);
          await service.deleteAccount('user-1', 'correct-password');

          expect(reportUpdateManySpy).toHaveBeenCalledWith({
            where: { id: { in: ['report-1'] } },
            data: { reportedContent: AUTHOR_DELETED_CONTENT },
          });
        });
      });

      it('kullanicinin_hic_mesaji_yoksa_updateMany_cagrilarini_atlar', async () => {
        const passwordHash = await argon2.hash('correct-password');
        const user = { id: 'user-1', email: 'a@koqep.local', passwordHash };
        const {
          prismaMock,
          messageFindManySpy,
          messageUpdateManySpy,
          messageEditUpdateManySpy,
          reportUpdateManySpy,
        } = buildDeleteAccountPrismaMock(user, {
          messageFindMany: jest.fn().mockResolvedValue([]),
        });

        const service = buildService(prismaMock);
        await service.deleteAccount(
          'user-1',
          'correct-password',
          undefined,
          true,
        );

        expect(messageFindManySpy).toHaveBeenCalled();
        expect(messageUpdateManySpy).not.toHaveBeenCalled();
        expect(messageEditUpdateManySpy).not.toHaveBeenCalled();
        expect(reportUpdateManySpy).not.toHaveBeenCalled();
      });
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

    // M7a Slice F (kullanıcının review'ında bulunan gerçek bug): e-posta
    // erişimini kanıtlamak kilit mekanizmasının kendisinden daha güçlü bir
    // doğrulama - sıfırlama sonrası kilit kalıcı kalırsa kullanıcı için
    // açıklanamaz bir durum olurdu.
    it('kilit_alanlarini_da_temizler', async () => {
      const stored = {
        id: 'prt-1',
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
          passwordResetToken: { findUnique: jest.Mock };
        }
      ).passwordResetToken = {
        findUnique: jest.fn().mockResolvedValue(stored),
      };

      const service = buildService(prismaMock);
      await service.confirmPasswordReset('raw-token', 'a-new-password');

      expect(userUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginCount: 0,
            lockedUntil: null,
          }) as unknown,
        }),
      );
    });

    it('reddeder_bilinen_sizdirilmis_sifreyi', async () => {
      const stored = {
        id: 'prt-1',
        tokenHash: 'x',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      };
      const prismaMock: Partial<PrismaService> = {
        passwordResetToken: {
          findUnique: jest.fn().mockResolvedValue(stored),
        } as unknown as PrismaService['passwordResetToken'],
      };
      const passwordPolicyMock: Partial<PasswordPolicyService> = {
        assertNotBreached: jest.fn().mockRejectedValue(
          new BadRequestException({
            code: 'PASSWORD_BREACHED',
            message:
              'Bu şifre bilinen bir veri sızıntısında bulunmuş, başka bir şifre seç.',
          }),
        ),
      };

      const service = buildService(
        prismaMock,
        {},
        undefined,
        {},
        undefined,
        undefined,
        undefined,
        passwordPolicyMock,
      );

      await expect(
        service.confirmPasswordReset('raw-token', 'a-breached-password'),
      ).rejects.toMatchObject({ response: { code: 'PASSWORD_BREACHED' } });
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
      ).rejects.toMatchObject({ response: { code: 'INVALID_RESET_TOKEN' } });
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
      ).rejects.toMatchObject({ response: { code: 'INVALID_RESET_TOKEN' } });
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
      ).rejects.toMatchObject({ response: { code: 'INVALID_RESET_TOKEN' } });
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
      ).rejects.toMatchObject({ response: { code: 'INVALID_RESET_TOKEN' } });
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
      ).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_TOKEN' },
      });
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
      ).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_TOKEN' },
      });
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
      ).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_TOKEN' },
      });
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
      ).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_TOKEN' },
      });
    });
  });
});
