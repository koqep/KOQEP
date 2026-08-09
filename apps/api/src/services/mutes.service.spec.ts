import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MutesService,
  MUTE_APPLIED_ACTION,
  MUTE_LIFTED_ACTION,
  INVITER_INVITE_REVOKED_ACTION,
  INVITER_INVITE_DEBT_INCURRED_ACTION,
} from './mutes.service';
import { PrismaService } from '../db/prisma.service';
import { InvitesService } from './invites.service';

describe('MutesService', () => {
  // liftMute array-form $transaction'da kalıyor (Slice E sadece applyMute'u
  // callback-form'a çeviriyor) - bu yüzden iki ayrı mock builder var.
  function buildArrayTransactionMock(): jest.Mock {
    return jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  }

  function buildCallbackTxMock(): {
    transactionMock: jest.Mock;
    userUpdateMock: jest.Mock;
    auditCreateMock: jest.Mock;
  } {
    const userUpdateMock = jest.fn().mockResolvedValue({});
    const auditCreateMock = jest.fn().mockResolvedValue({});
    const tx = {
      user: { update: userUpdateMock },
      moderationAuditLog: { create: auditCreateMock },
    } as unknown as Prisma.TransactionClient;
    const transactionMock = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );
    return { transactionMock, userUpdateMock, auditCreateMock };
  }

  function buildInvitesServiceMock(): Partial<InvitesService> {
    return {
      applyInviterConsequence: jest
        .fn()
        .mockResolvedValue({ revokedInviteId: null, debtIncurred: false }),
    };
  }

  describe('applyMute', () => {
    it('mutedUntili_dogru_hesaplar_ve_denetim_satiri_yazar', async () => {
      const { transactionMock, userUpdateMock, auditCreateMock } =
        buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: null,
            inviterId: null,
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      const before = Date.now();
      const result = await service.applyMute('moderator-1', 'user-1', 24);
      const after = Date.now();

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      const call = userUpdateMock.mock.calls[0] as [
        { data: { mutedUntil: Date } },
      ];
      const mutedUntilMs = call[0].data.mutedUntil.getTime();
      expect(mutedUntilMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
      expect(mutedUntilMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: MUTE_APPLIED_ACTION,
          targetUserId: 'user-1',
        },
      });
      expect(result.mutedUntil.getTime()).toBe(mutedUntilMs);
      expect(invitesServiceMock.applyInviterConsequence).not.toHaveBeenCalled();
    });

    it('reddeder_bilinmeyen_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );

      await expect(
        service.applyMute('moderator-1', 'yok-kullanici', 24),
      ).rejects.toThrow(NotFoundException);
    });

    it('tekrar_mute_mutedUntili_stacklemeden_degistirir', async () => {
      const { transactionMock, userUpdateMock } = buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: null,
            inviterId: null,
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.applyMute('moderator-1', 'user-1', 1);
      await service.applyMute('moderator-1', 'user-1', 24);

      expect(userUpdateMock).toHaveBeenCalledTimes(2);
      const firstCall = userUpdateMock.mock.calls[0] as [
        { data: { mutedUntil: Date } },
      ];
      const secondCall = userUpdateMock.mock.calls[1] as [
        { data: { mutedUntil: Date } },
      ];
      expect(secondCall[0].data.mutedUntil.getTime()).toBeGreaterThan(
        firstCall[0].data.mutedUntil.getTime(),
      );
    });

    it('davetcinin_kullanilmamis_daveti_varsa_iptal_eder_ve_denetim_satirina_yazar', async () => {
      const { transactionMock, auditCreateMock } = buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: null,
            inviterId: 'inviter-1',
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock: Partial<InvitesService> = {
        applyInviterConsequence: jest.fn().mockResolvedValue({
          revokedInviteId: 'invite-1',
          debtIncurred: false,
        }),
      };

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.applyMute('moderator-1', 'user-1', 24);

      expect(invitesServiceMock.applyInviterConsequence).toHaveBeenCalledWith(
        expect.anything(),
        'inviter-1',
      );
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          actionType: INVITER_INVITE_REVOKED_ACTION,
          targetUserId: 'inviter-1',
          targetInviteId: 'invite-1',
        },
      });
      // moderatorId BİLEREK bu satırda yok - otomatik bir sonuç.
      const inviterCall = auditCreateMock.mock.calls.find(
        (args: [{ data: { actionType: string } }]) =>
          args[0].data.actionType === INVITER_INVITE_REVOKED_ACTION,
      ) as [{ data: Record<string, unknown> }];
      expect(inviterCall[0].data).not.toHaveProperty('moderatorId');
    });

    it('davetcinin_kullanilmamis_daveti_yoksa_borc_denetim_satirina_yazar', async () => {
      const { transactionMock, auditCreateMock } = buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: null,
            inviterId: 'inviter-1',
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock: Partial<InvitesService> = {
        applyInviterConsequence: jest
          .fn()
          .mockResolvedValue({ revokedInviteId: null, debtIncurred: true }),
      };

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.applyMute('moderator-1', 'user-1', 24);

      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          actionType: INVITER_INVITE_DEBT_INCURRED_ACTION,
          targetUserId: 'inviter-1',
        },
      });
    });

    it('davetcisi_olmayan_kullanici_icin_davet_sonucu_tetiklenmez', async () => {
      const { transactionMock } = buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: null,
            inviterId: null,
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.applyMute('moderator-1', 'user-1', 24);

      expect(invitesServiceMock.applyInviterConsequence).not.toHaveBeenCalled();
    });

    it('zaten_susturulmus_kullaniciyi_yeniden_mute_etmek_davetciyi_ikinci_kez_etkilemez', async () => {
      const { transactionMock } = buildCallbackTxMock();
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            mutedUntil: new Date(Date.now() + 60 * 60 * 1000),
            inviterId: 'inviter-1',
          }),
        } as unknown as PrismaService['user'],
        $transaction: transactionMock,
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.applyMute('moderator-1', 'user-1', 24);

      expect(invitesServiceMock.applyInviterConsequence).not.toHaveBeenCalled();
    });
  });

  describe('liftMute', () => {
    it('mutedUntili_null_yapar_ve_denetim_satiri_yazar', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({});
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
          update: userUpdateMock,
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await service.liftMute('moderator-1', 'user-1');

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { mutedUntil: null },
      });
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: MUTE_LIFTED_ACTION,
          targetUserId: 'user-1',
        },
      });
    });

    it('zaten_susturulmamis_kullaniciyi_no_op_olarak_kaldirir', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({});
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'user-1', mutedUntil: null }),
          update: userUpdateMock,
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildArrayTransactionMock(),
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );
      await expect(
        service.liftMute('moderator-1', 'user-1'),
      ).resolves.toBeUndefined();

      expect(auditCreateMock).toHaveBeenCalledTimes(1);
    });

    it('reddeder_bilinmeyen_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };
      const invitesServiceMock = buildInvitesServiceMock();

      const service = new MutesService(
        prismaMock as PrismaService,
        invitesServiceMock as InvitesService,
      );

      await expect(
        service.liftMute('moderator-1', 'yok-kullanici'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
