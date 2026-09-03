import {
  ModeratorRoleService,
  MODERATOR_ASSIGNED_ACTION,
  MODERATOR_REVOKED_ACTION,
} from './moderator-role.service';
import { PrismaService } from '../db/prisma.service';
import { AuthService } from './auth.service';

describe('ModeratorRoleService', () => {
  // assignModerator/revokeModerator ikisi de array-form $transaction
  // kullanıyor (liftMute'un AYNI deseni) - callback-form gerekmiyor.
  function buildArrayTransactionMock(): jest.Mock {
    return jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  }

  function buildAuthServiceMock(): Partial<AuthService> {
    return { verifyCurrentPassword: jest.fn().mockResolvedValue(undefined) };
  }

  describe('assignModerator', () => {
    it('dogru_reauth_ile_moderator_yapar_ve_denetim_satiri_yazar', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@koqep.local',
        role: 'moderator',
      });
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'user',
          }),
          update: userUpdateMock,
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      const result = await service.assignModerator(
        'moderator-1',
        'correct-password',
        undefined,
        'a@koqep.local',
      );

      expect(authServiceMock.verifyCurrentPassword).toHaveBeenCalledWith(
        'moderator-1',
        'correct-password',
        undefined,
      );
      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'moderator' },
      });
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: MODERATOR_ASSIGNED_ACTION,
          targetUserId: 'user-1',
        },
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'a@koqep.local',
        role: 'moderator',
        alreadyModerator: false,
      });
    });

    it('yanlis_reauth_hatasini_kendi_islemeden_yayar', async () => {
      const authError = new Error('reauth-failed');
      const authServiceMock: Partial<AuthService> = {
        verifyCurrentPassword: jest.fn().mockRejectedValue(authError),
      };
      const prismaMock: Partial<PrismaService> = {};
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      await expect(
        service.assignModerator(
          'moderator-1',
          'wrong',
          undefined,
          'a@koqep.local',
        ),
      ).rejects.toBe(authError);
    });

    it('zaten_moderator_olan_icin_alreadyModerator_true_doner_ve_yine_de_denetim_satiri_yazar', async () => {
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'moderator',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'moderator',
          }),
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      const result = await service.assignModerator(
        'moderator-1',
        'correct-password',
        undefined,
        'a@koqep.local',
      );

      expect(result.alreadyModerator).toBe(true);
      expect(auditCreateMock).toHaveBeenCalledTimes(1);
    });

    it('reddeder_bilinmeyen_email', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      await expect(
        service.assignModerator(
          'moderator-1',
          'correct-password',
          undefined,
          'yok@koqep.local',
        ),
      ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
    });
  });

  describe('revokeModerator', () => {
    it('moderatoru_user_yapar_ve_denetim_satiri_yazar', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@koqep.local',
        role: 'user',
      });
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'moderator',
          }),
          update: userUpdateMock,
          count: jest.fn().mockResolvedValue(2),
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      const result = await service.revokeModerator(
        'moderator-1',
        'a@koqep.local',
      );

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'user' },
      });
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: MODERATOR_REVOKED_ACTION,
          targetUserId: 'user-1',
        },
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'a@koqep.local',
        role: 'user',
        wasNotModerator: false,
      });
    });

    it('zaten_user_olan_icin_wasNotModerator_true_doner_ve_yine_de_denetim_satiri_yazar', async () => {
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'user',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'a@koqep.local',
            role: 'user',
          }),
          count: jest.fn().mockResolvedValue(2),
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      const result = await service.revokeModerator(
        'moderator-1',
        'a@koqep.local',
      );

      expect(result.wasNotModerator).toBe(true);
      expect(auditCreateMock).toHaveBeenCalledTimes(1);
    });

    it('son_moderator_kendini_dusuremez', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'moderator-1',
            email: 'a@koqep.local',
            role: 'moderator',
          }),
          count: jest.fn().mockResolvedValue(1),
        } as unknown as PrismaService['user'],
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      await expect(
        service.revokeModerator('moderator-1', 'a@koqep.local'),
      ).rejects.toMatchObject({
        response: { code: 'LAST_MODERATOR_CANNOT_REVOKE_SELF' },
      });
    });

    it('baskasini_dusurmek_moderator_sayisindan_bagimsiz_calisir', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({
        id: 'user-2',
        email: 'b@koqep.local',
        role: 'user',
      });
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-2',
            email: 'b@koqep.local',
            role: 'moderator',
          }),
          update: userUpdateMock,
          count: jest.fn().mockResolvedValue(1),
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      await expect(
        service.revokeModerator('moderator-1', 'b@koqep.local'),
      ).resolves.toMatchObject({ id: 'user-2', role: 'user' });
    });

    it('reddeder_bilinmeyen_email', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const authServiceMock = buildAuthServiceMock();
      const service = new ModeratorRoleService(
        prismaMock as PrismaService,
        authServiceMock as AuthService,
      );

      await expect(
        service.revokeModerator('moderator-1', 'yok@koqep.local'),
      ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
    });
  });
});
