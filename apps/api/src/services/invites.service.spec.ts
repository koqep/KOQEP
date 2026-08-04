import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvitesService } from './invites.service';
import { PrismaService } from '../db/prisma.service';

describe('InvitesService', () => {
  function buildService(prismaMock: Partial<PrismaService>): InvitesService {
    return new InvitesService(prismaMock as PrismaService);
  }

  it('doner_kullanilmamis_daveti', async () => {
    const invite = { id: 'invite-1', code: 'ABC123', usedAt: null };
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

  describe('grantInvites', () => {
    function buildTxMock(): {
      tx: Prisma.TransactionClient;
      createManyMock: jest.Mock;
    } {
      const createManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const tx = {
        invite: { createMany: createManyMock },
      } as unknown as Prisma.TransactionClient;
      return { tx, createManyMock };
    }

    it('istenen_sayida_benzersiz_kodlu_satiri_tek_createMany_ile_yazar', async () => {
      const { tx, createManyMock } = buildTxMock();
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 3);

      expect(createManyMock).toHaveBeenCalledTimes(1);
      const { data } = createManyMock.mock.calls[0][0] as {
        data: { code: string; issuedById: string }[];
      };
      expect(data).toHaveLength(3);
      expect(data.every((row) => row.issuedById === 'user-1')).toBe(true);
      const codes = data.map((row) => row.code);
      expect(new Set(codes).size).toBe(3);
    });

    it('sifir_sayida_davet_istenince_bos_bir_createMany_cagirir', async () => {
      const { tx, createManyMock } = buildTxMock();
      const service = buildService({});

      await service.grantInvites(tx, 'user-1', 0);

      expect(createManyMock).toHaveBeenCalledWith({ data: [] });
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
          issuedById: 'user-1',
          usedById: null,
        },
        {
          id: 'i1',
          code: 'CODE1',
          createdAt: new Date('2026-08-01'),
          usedAt: new Date('2026-08-03'),
          issuedById: 'user-1',
          usedById: 'user-2',
        },
      ];
      const findManyMock = jest.fn().mockResolvedValue(rows);
      const prismaMock: Partial<PrismaService> = {
        invite: { findMany: findManyMock } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);
      const result = await service.listInvites('user-1');

      expect(findManyMock).toHaveBeenCalledWith({
        where: { issuedById: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        { code: 'CODE2', createdAt: rows[0].createdAt, usedAt: null },
        { code: 'CODE1', createdAt: rows[1].createdAt, usedAt: rows[1].usedAt },
      ]);
      // Redeemer kimliği (usedById) DTO'ya hiç sızmamalı.
      result.forEach((dto) => {
        expect(dto).not.toHaveProperty('usedById');
      });
    });
  });
});
