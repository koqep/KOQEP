import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../db/prisma.service';
import { SocketRegistryService } from './socket-registry.service';

describe('RoomsService', () => {
  function buildService(
    prismaMock: Partial<PrismaService>,
    socketRegistryMock: Partial<SocketRegistryService> = {
      getSockets: () => [],
    },
  ): RoomsService {
    return new RoomsService(
      prismaMock as PrismaService,
      socketRegistryMock as SocketRegistryService,
    );
  }

  describe('listRooms', () => {
    it('odalari_isme_gore_alfabetik_dondurur', async () => {
      const findManyMock = jest.fn().mockResolvedValue([
        {
          id: 'room-general',
          name: 'general',
          description: null,
          lastActivityAt: new Date('2026-01-01'),
        },
        {
          id: 'room-meta',
          name: 'meta',
          description: 'meta konusu',
          lastActivityAt: new Date('2026-01-02'),
        },
      ]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findMany: findManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const rooms = await service.listRooms();

      expect(findManyMock).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(rooms).toHaveLength(2);
    });
  });

  describe('createRoom', () => {
    it('oda_olusturur_ve_olusturanin_soketlerini_katar', async () => {
      const room = {
        id: 'room-1',
        name: 'elden-ring',
        description: 'Elden Ring tartışması',
        lastActivityAt: new Date(),
      };
      const findFirstMock = jest.fn().mockResolvedValue(null);
      const createMock = jest.fn().mockResolvedValue(room);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: findFirstMock,
          create: createMock,
        } as unknown as PrismaService['room'],
      };
      const joinMock = jest.fn();
      const socketRegistryMock: Partial<SocketRegistryService> = {
        getSockets: () => [{ join: joinMock } as never],
      };

      const service = buildService(prismaMock, socketRegistryMock);
      const result = await service.createRoom(
        'user-1',
        'elden-ring',
        'Elden Ring tartışması',
      );

      expect(findFirstMock).toHaveBeenCalledWith({
        where: { name: { equals: 'elden-ring', mode: 'insensitive' } },
      });
      expect(createMock).toHaveBeenCalledWith({
        data: {
          name: 'elden-ring',
          description: 'Elden Ring tartışması',
          creatorId: 'user-1',
        },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
        },
      });
      expect(joinMock).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(room);
    });

    it('reddeder_buyuk_kucuk_harf_farkli_ama_ayni_ismi_on_kontrolde', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-room' }),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(service.createRoom('user-1', 'General')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reddeder_yarisi_kaybedilen_ismi_p2002_backstopuyla', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
      );
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue(uniqueError),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(service.createRoom('user-1', 'general')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('archiveSilentRooms', () => {
    it('14_gunden_eski_odalari_cekirdek_disinda_arsivler', async () => {
      const now = new Date('2026-08-15T00:00:00.000Z');
      const updateManyMock = jest.fn().mockResolvedValue({ count: 3 });
      const prismaMock: Partial<PrismaService> = {
        room: {
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const result = await service.archiveSilentRooms(now);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          status: 'active',
          lastActivityAt: { lt: new Date('2026-08-01T00:00:00.000Z') },
          name: { notIn: ['general', 'meta'] },
        },
        data: { status: 'archived', archivedAt: now },
      });
      expect(result).toEqual({ archivedCount: 3 });
    });

    it('now_verilmezse_gercek_saati_kullanir', async () => {
      let capturedArchivedAt: Date | undefined;
      const updateManyMock = jest
        .fn()
        .mockImplementation((args: { data: { archivedAt: Date } }) => {
          capturedArchivedAt = args.data.archivedAt;
          return Promise.resolve({ count: 0 });
        });
      const prismaMock: Partial<PrismaService> = {
        room: {
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const before = Date.now();
      await service.archiveSilentRooms();
      const after = Date.now();

      expect(capturedArchivedAt).toBeDefined();
      const usedNow = capturedArchivedAt!.getTime();
      expect(usedNow).toBeGreaterThanOrEqual(before);
      expect(usedNow).toBeLessThanOrEqual(after);
    });
  });
});
