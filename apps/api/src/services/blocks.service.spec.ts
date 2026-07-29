import { ConflictException, NotFoundException } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { PrismaService } from '../db/prisma.service';

describe('BlocksService', () => {
  function buildService(prismaMock: Partial<PrismaService>): BlocksService {
    return new BlocksService(prismaMock as PrismaService);
  }

  describe('block', () => {
    it('bulunan_kullaniciyi_upsert_ile_engeller', async () => {
      const upsertSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'blocked-1', email: 'b@koqep.local' }),
        } as unknown as PrismaService['user'],
        block: {
          upsert: upsertSpy,
        } as unknown as PrismaService['block'],
      };

      const service = buildService(prismaMock);
      await service.block('blocker-1', 'b@koqep.local');

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId: 'blocker-1',
            blockedId: 'blocked-1',
          },
        },
        update: {},
        create: { blockerId: 'blocker-1', blockedId: 'blocked-1' },
      });
    });

    it('reddeder_kendini_engellemeyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'user-1', email: 'a@koqep.local' }),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.block('user-1', 'a@koqep.local')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reddeder_bulunamayan_e_postayi', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(service.block('user-1', 'yok@koqep.local')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unblock', () => {
    it('siler_engeli_varsa', async () => {
      const deleteManySpy = jest.fn().mockResolvedValue({ count: 1 });
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'blocked-1', email: 'b@koqep.local' }),
        } as unknown as PrismaService['user'],
        block: {
          deleteMany: deleteManySpy,
        } as unknown as PrismaService['block'],
      };

      const service = buildService(prismaMock);
      await service.unblock('blocker-1', 'b@koqep.local');

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { blockerId: 'blocker-1', blockedId: 'blocked-1' },
      });
    });

    it('bulunamayan_e_posta_icin_sessizce_gecer', async () => {
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.unblock('blocker-1', 'yok@koqep.local'),
      ).resolves.toBeUndefined();
    });
  });

  describe('listBlockedEmails', () => {
    it('engellenen_e_postalari_dondurur', async () => {
      const prismaMock: Partial<PrismaService> = {
        block: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { blocked: { email: 'b@koqep.local' } },
              { blocked: { email: 'c@koqep.local' } },
            ]),
        } as unknown as PrismaService['block'],
      };

      const service = buildService(prismaMock);
      const emails = await service.listBlockedEmails('blocker-1');

      expect(emails).toEqual(['b@koqep.local', 'c@koqep.local']);
    });
  });

  describe('getBlockedAuthorIds / getBlockerIdsOf', () => {
    it('dogru_id_listelerini_dondurur', async () => {
      const findManyMock = jest
        .fn()
        .mockResolvedValueOnce([{ blockedId: 'b1' }, { blockedId: 'b2' }])
        .mockResolvedValueOnce([{ blockerId: 'a1' }]);
      const prismaMock: Partial<PrismaService> = {
        block: {
          findMany: findManyMock,
        } as unknown as PrismaService['block'],
      };

      const service = buildService(prismaMock);

      await expect(service.getBlockedAuthorIds('blocker-1')).resolves.toEqual([
        'b1',
        'b2',
      ]);
      await expect(service.getBlockerIdsOf('author-1')).resolves.toEqual([
        'a1',
      ]);
    });
  });
});
