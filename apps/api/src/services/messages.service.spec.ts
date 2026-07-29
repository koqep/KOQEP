import { NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { BlocksService } from './blocks.service';
import { PrismaService } from '../db/prisma.service';
import { DEV_ROOM_NAME } from '../db/dev-seed.constants';

describe('MessagesService', () => {
  const room = { id: 'room-1', name: DEV_ROOM_NAME };

  function buildService(
    prismaMock: Partial<PrismaService>,
    blocksMock: Partial<BlocksService> = {
      getBlockedAuthorIds: jest.fn().mockResolvedValue([]),
    },
  ): MessagesService {
    return new MessagesService(
      prismaMock as PrismaService,
      blocksMock as BlocksService,
    );
  }

  describe('sendMessage', () => {
    it('mesaji_dogru_oda_ve_yazar_ile_olusturur', async () => {
      const created = {
        id: 'msg-1',
        content: 'merhaba',
        createdAt: new Date('2026-01-01'),
        author: { email: 'dev@koqep.local' },
      };
      const createMock = jest.fn().mockResolvedValue(created);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        message: {
          create: createMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      const result = await service.sendMessage('user-1', 'merhaba');

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: 'merhaba', roomId: room.id, authorId: 'user-1' },
        }),
      );
      expect(result).toEqual({
        id: 'msg-1',
        content: 'merhaba',
        createdAt: created.createdAt,
        authorEmail: 'dev@koqep.local',
      });
    });

    it('reddeder_oda_bulunamazsa', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(service.sendMessage('user-1', 'merhaba')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRecentMessages', () => {
    it('sonraki_cursoru_dogru_hesaplar_ve_eskiden_yeniye_sirlar', async () => {
      // Prisma'nin gercekte donduguyle ayni sirada: createdAt/id'ye gore
      // azalan (en yeni once) - servis bu sirayi varsayiyor.
      const rows = Array.from({ length: 51 }, (_, i) => {
        const n = 50 - i;
        return {
          id: `msg-${n}`,
          content: `mesaj ${n}`,
          createdAt: new Date(2026, 0, 1, 0, 0, n),
          author: { email: 'dev@koqep.local' },
        };
      });
      const findManyMock = jest.fn().mockResolvedValue(rows);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      const page = await service.getRecentMessages(
        DEV_ROOM_NAME,
        'requester-1',
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: room.id },
          take: 51,
        }),
      );
      expect(page.messages).toHaveLength(50);
      expect(page.messages[0].id).toBe('msg-1');
      expect(page.messages[49].id).toBe('msg-50');
      expect(page.nextCursor).toBe('msg-1');
    });

    it('cursor_verildiginde_sorguya_dahil_eder', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      await service.getRecentMessages(
        DEV_ROOM_NAME,
        'requester-1',
        'msg-10',
        20,
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'msg-10' },
          skip: 1,
          take: 21,
        }),
      );
    });

    it('reddeder_oda_bulunamazsa', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.getRecentMessages('yok-oda', 'requester-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('engellenen_yazarlarin_mesajlarini_disarida_birakir', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };
      const blocksMock: Partial<BlocksService> = {
        getBlockedAuthorIds: jest.fn().mockResolvedValue(['blocked-1']),
      };

      const service = buildService(prismaMock, blocksMock);
      await service.getRecentMessages(DEV_ROOM_NAME, 'requester-1');

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId: room.id,
            OR: [{ authorId: null }, { authorId: { notIn: ['blocked-1'] } }],
          },
        }),
      );
    });

    it('engellenen_kimse_yoksa_ekstra_filtre_eklemez', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      await service.getRecentMessages(DEV_ROOM_NAME, 'requester-1');

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: room.id },
        }),
      );
    });
  });
});
