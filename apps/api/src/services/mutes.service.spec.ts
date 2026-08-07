import { NotFoundException } from '@nestjs/common';
import {
  MutesService,
  MUTE_APPLIED_ACTION,
  MUTE_LIFTED_ACTION,
} from './mutes.service';
import { PrismaService } from '../db/prisma.service';

describe('MutesService', () => {
  function buildTransactionMock(): jest.Mock {
    return jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  }

  describe('applyMute', () => {
    it('mutedUntili_dogru_hesaplar_ve_denetim_satiri_yazar', async () => {
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
        $transaction: buildTransactionMock(),
      };

      const service = new MutesService(prismaMock as PrismaService);
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
    });

    it('reddeder_bilinmeyen_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = new MutesService(prismaMock as PrismaService);

      await expect(
        service.applyMute('moderator-1', 'yok-kullanici', 24),
      ).rejects.toThrow(NotFoundException);
    });

    it('tekrar_mute_mutedUntili_stacklemeden_degistirir', async () => {
      const userUpdateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
          update: userUpdateMock,
        } as unknown as PrismaService['user'],
        moderationAuditLog: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: buildTransactionMock(),
      };

      const service = new MutesService(prismaMock as PrismaService);
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
        $transaction: buildTransactionMock(),
      };

      const service = new MutesService(prismaMock as PrismaService);
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
        $transaction: buildTransactionMock(),
      };

      const service = new MutesService(prismaMock as PrismaService);
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

      const service = new MutesService(prismaMock as PrismaService);

      await expect(
        service.liftMute('moderator-1', 'yok-kullanici'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
