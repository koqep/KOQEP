import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvitesService } from './invites.service';
import { PrismaService } from '../db/prisma.service';

describe('InvitesService', () => {
  function buildService(prismaMock: Partial<PrismaService>): InvitesService {
    return new InvitesService(prismaMock as PrismaService);
  }

  describe('findRedeemableInvite', () => {
    it('doner_kullanilmamis_daveti', async () => {
      const invite = {
        id: 'invite-1',
        code: 'ABC123',
        usedAt: null,
        revokedAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        invite: {
          findUnique: jest.fn().mockResolvedValue(invite),
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);

      await expect(service.findRedeemableInvite('ABC123')).resolves.toEqual(
        invite,
      );
    });

    it('reddeder_bulunamayan_davet_kodu', async () => {
      const prismaMock: Partial<PrismaService> = {
        invite: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);

      await expect(service.findRedeemableInvite('YOK')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reddeder_kullanilmis_davet_kodu', async () => {
      const invite = {
        id: 'invite-1',
        code: 'ABC123',
        usedAt: new Date(),
        revokedAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        invite: {
          findUnique: jest.fn().mockResolvedValue(invite),
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);

      await expect(service.findRedeemableInvite('ABC123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reddeder_revoke_edilmis_davet_kodunu', async () => {
      const invite = {
        id: 'invite-1',
        code: 'ABC123',
        usedAt: null,
        revokedAt: new Date(),
      };
      const prismaMock: Partial<PrismaService> = {
        invite: {
          findUnique: jest.fn().mockResolvedValue(invite),
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);

      await expect(service.findRedeemableInvite('ABC123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('grantInvites', () => {
    function buildTxMock(pendingInviteDebt: number): {
      tx: Prisma.TransactionClient;
      createManyMock: jest.Mock;
      userUpdateMock: jest.Mock;
    } {
      const createManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const userUpdateMock = jest.fn().mockResolvedValue({});
      const tx = {
        invite: { createMany: createManyMock },
        user: {
          findUnique: jest.fn().mockResolvedValue({ pendingInviteDebt }),
          update: userUpdateMock,
        },
      } as unknown as Prisma.TransactionClient;
      return { tx, createManyMock, userUpdateMock };
    }

    it('borcu_olmayan_kullaniciya_istenen_sayida_benzersiz_kodlu_satiri_tek_createMany_ile_yazar', async () => {
      const { tx, createManyMock, userUpdateMock } = buildTxMock(0);
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 3);

      expect(userUpdateMock).not.toHaveBeenCalled();
      expect(createManyMock).toHaveBeenCalledTimes(1);
      const [[call]] = createManyMock.mock.calls as [
        [{ data: { code: string; issuedById: string }[] }],
      ];
      const { data } = call;
      expect(data).toHaveLength(3);
      expect(data.every((row) => row.issuedById === 'user-1')).toBe(true);
      const codes = data.map((row) => row.code);
      expect(new Set(codes).size).toBe(3);
    });

    it('sifir_sayida_davet_istenince_createMany_hic_cagrilmaz', async () => {
      const { tx, createManyMock } = buildTxMock(0);
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 0);

      expect(createManyMock).not.toHaveBeenCalled();
    });

    it('borc_sayidan_azsa_borcu_karsilar_kalani_gercek_davet_olarak_yazar', async () => {
      const { tx, createManyMock, userUpdateMock } = buildTxMock(1);
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 3);

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pendingInviteDebt: { decrement: 1 } },
      });
      const [[call]] = createManyMock.mock.calls as [
        [{ data: { code: string }[] }],
      ];
      expect(call.data).toHaveLength(2);
    });

    it('borc_sayidan_fazlaysa_tamami_borcu_karsilar_hic_davet_yazilmaz', async () => {
      const { tx, createManyMock, userUpdateMock } = buildTxMock(5);
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 2);

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pendingInviteDebt: { decrement: 2 } },
      });
      expect(createManyMock).not.toHaveBeenCalled();
    });
  });

  describe('applyInviterConsequence', () => {
    function buildTxMock(): {
      tx: Prisma.TransactionClient;
      findFirstMock: jest.Mock;
      updateManyMock: jest.Mock;
      userUpdateMock: jest.Mock;
    } {
      const findFirstMock = jest.fn();
      const updateManyMock = jest.fn();
      const userUpdateMock = jest.fn().mockResolvedValue({});
      const tx = {
        invite: { findFirst: findFirstMock, updateMany: updateManyMock },
        user: { update: userUpdateMock },
      } as unknown as Prisma.TransactionClient;
      return { tx, findFirstMock, updateManyMock, userUpdateMock };
    }

    it('kullanilmamis_davet_varsa_en_eskisini_revoke_eder', async () => {
      const { tx, findFirstMock, updateManyMock, userUpdateMock } =
        buildTxMock();
      findFirstMock.mockResolvedValue({ id: 'invite-1' });
      updateManyMock.mockResolvedValue({ count: 1 });
      const service = buildService({});

      const result = await service.applyInviterConsequence(tx, 'inviter-1');

      expect(findFirstMock).toHaveBeenCalledWith({
        where: { issuedById: 'inviter-1', usedAt: null, revokedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      expect(updateManyMock).toHaveBeenCalledWith({
        where: { id: 'invite-1', usedAt: null, revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date) as Date,
        }) as Prisma.InviteUpdateManyMutationInput,
      });
      expect(userUpdateMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        revokedInviteId: 'invite-1',
        debtIncurred: false,
      });
    });

    it('kullanilmamis_davet_yoksa_borc_biriktirir', async () => {
      const { tx, findFirstMock, userUpdateMock } = buildTxMock();
      findFirstMock.mockResolvedValue(null);
      const service = buildService({});

      const result = await service.applyInviterConsequence(tx, 'inviter-1');

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'inviter-1' },
        data: { pendingInviteDebt: { increment: 1 } },
      });
      expect(result).toEqual({ revokedInviteId: null, debtIncurred: true });
    });

    it('toctou_yarisinda_kaybedince_borc_biriktirir', async () => {
      // findFirst bir aday buldu ama updateMany 0 satır etkiledi - başka
      // bir eşzamanlı işlem (signup claim'i YA DA ikinci bir applyMute)
      // araya girdi. Sessizce başarısız olmak yerine borca düşüyor.
      const { tx, findFirstMock, updateManyMock, userUpdateMock } =
        buildTxMock();
      findFirstMock.mockResolvedValue({ id: 'invite-1' });
      updateManyMock.mockResolvedValue({ count: 0 });
      const service = buildService({});

      const result = await service.applyInviterConsequence(tx, 'inviter-1');

      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'inviter-1' },
        data: { pendingInviteDebt: { increment: 1 } },
      });
      expect(result).toEqual({ revokedInviteId: null, debtIncurred: true });
    });
  });

  describe('listInvites', () => {
    it('kullanicinin_kendi_davetlerini_en_yeniden_eskiye_dondurur', async () => {
      const rows = [
        {
          id: 'i2',
          code: 'CODE2',
          createdAt: new Date('2026-08-02'),
          usedAt: null,
          revokedAt: null,
          issuedById: 'user-1',
          usedById: null,
        },
        {
          id: 'i1',
          code: 'CODE1',
          createdAt: new Date('2026-08-01'),
          usedAt: new Date('2026-08-03'),
          revokedAt: null,
          issuedById: 'user-1',
          usedById: 'user-2',
        },
      ];
      const findManyMock = jest.fn().mockResolvedValue(rows);
      const prismaMock: Partial<PrismaService> = {
        invite: {
          findMany: findManyMock,
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);
      const result = await service.listInvites('user-1');

      expect(findManyMock).toHaveBeenCalledWith({
        where: { issuedById: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        {
          code: 'CODE2',
          createdAt: rows[0].createdAt,
          usedAt: null,
          revokedAt: null,
        },
        {
          code: 'CODE1',
          createdAt: rows[1].createdAt,
          usedAt: rows[1].usedAt,
          revokedAt: null,
        },
      ]);
      // Redeemer kimliği (usedById) DTO'ya hiç sızmamalı.
      result.forEach((dto) => {
        expect(dto).not.toHaveProperty('usedById');
      });
    });
  });
});
