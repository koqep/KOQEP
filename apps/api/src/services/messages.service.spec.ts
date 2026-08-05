import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { BlocksService } from './blocks.service';
import {
  ReputationService,
  MESSAGE_SENT_ACTION,
  MESSAGE_SENT_XP,
} from './reputation.service';
import { InvitesService } from './invites.service';
import { PrismaService } from '../db/prisma.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';

describe('MessagesService', () => {
  const room = { id: 'room-1', name: CORE_ROOM_NAMES[0], status: 'active' };
  const otherRoom = {
    id: 'room-2',
    name: CORE_ROOM_NAMES[1],
    status: 'active',
  };

  function buildService(
    prismaMock: Partial<PrismaService>,
    blocksMock: Partial<BlocksService> = {
      getBlockedAuthorIds: jest.fn().mockResolvedValue([]),
    },
    reputationServiceMock: Partial<ReputationService> = {
      awardXp: jest.fn().mockResolvedValue({ oldLevel: 0, newLevel: 0 }),
    },
    invitesServiceMock: Partial<InvitesService> = {
      grantInvites: jest.fn().mockResolvedValue(undefined),
    },
  ): MessagesService {
    return new MessagesService(
      prismaMock as PrismaService,
      blocksMock as BlocksService,
      reputationServiceMock as ReputationService,
      invitesServiceMock as InvitesService,
    );
  }

  describe('sendMessage', () => {
    function buildSendMessagePrismaMock(
      foundRoom: { id: string; name: string },
      created: unknown,
    ): {
      prismaMock: Partial<PrismaService>;
      findUniqueSpy: jest.Mock;
      createSpy: jest.Mock;
      roomUpdateSpy: jest.Mock;
    } {
      const createSpy = jest.fn().mockResolvedValue(created);
      const roomUpdateSpy = jest.fn().mockResolvedValue(foundRoom);
      const findUniqueSpy = jest.fn().mockResolvedValue(foundRoom);
      const txMock = {
        message: { create: createSpy },
        room: { update: roomUpdateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: findUniqueSpy,
        } as unknown as PrismaService['room'],
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      return { prismaMock, findUniqueSpy, createSpy, roomUpdateSpy };
    }

    it('mesaji_dogru_oda_ve_yazar_ile_olusturur', async () => {
      const created = {
        id: 'msg-1',
        content: 'merhaba',
        createdAt: new Date('2026-01-01'),
        roomId: room.id,
        author: { username: 'dev' },
      };
      const { prismaMock, createSpy, roomUpdateSpy } =
        buildSendMessagePrismaMock(room, created);
      const awardXpMock = jest
        .fn()
        .mockResolvedValue({ oldLevel: 0, newLevel: 0 });
      const grantInvitesMock = jest.fn().mockResolvedValue(undefined);

      const service = buildService(
        prismaMock,
        undefined,
        { awardXp: awardXpMock },
        { grantInvites: grantInvitesMock },
      );
      const result = await service.sendMessage(
        'user-1',
        CORE_ROOM_NAMES[0],
        'merhaba',
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: 'merhaba', roomId: room.id, authorId: 'user-1' },
        }),
      );
      expect(roomUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: room.id } }),
      );
      expect(awardXpMock).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        MESSAGE_SENT_ACTION,
        MESSAGE_SENT_XP,
        'msg-1',
      );
      // Seviye değişmedi (0 -> 0), davet verilmemeli.
      expect(grantInvitesMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'msg-1',
        content: 'merhaba',
        createdAt: created.createdAt,
        authorUsername: 'dev',
        roomId: room.id,
      });
    });

    it('seviye_bir_atlayinca_tam_bir_davet_verir', async () => {
      const created = {
        id: 'msg-1',
        content: 'merhaba',
        createdAt: new Date('2026-01-01'),
        roomId: room.id,
        author: { username: 'dev' },
      };
      const { prismaMock } = buildSendMessagePrismaMock(room, created);
      const grantInvitesMock = jest.fn().mockResolvedValue(undefined);

      const service = buildService(
        prismaMock,
        undefined,
        {
          awardXp: jest.fn().mockResolvedValue({ oldLevel: 0, newLevel: 1 }),
        },
        { grantInvites: grantInvitesMock },
      );
      await service.sendMessage('user-1', CORE_ROOM_NAMES[0], 'merhaba');

      expect(grantInvitesMock).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        1,
      );
    });

    it('tek_mesajda_birden_fazla_seviye_atlarsa_o_kadar_davet_verir', async () => {
      const created = {
        id: 'msg-1',
        content: 'merhaba',
        createdAt: new Date('2026-01-01'),
        roomId: room.id,
        author: { username: 'dev' },
      };
      const { prismaMock } = buildSendMessagePrismaMock(room, created);
      const grantInvitesMock = jest.fn().mockResolvedValue(undefined);

      const service = buildService(
        prismaMock,
        undefined,
        {
          awardXp: jest.fn().mockResolvedValue({ oldLevel: 0, newLevel: 3 }),
        },
        { grantInvites: grantInvitesMock },
      );
      await service.sendMessage('user-1', CORE_ROOM_NAMES[0], 'merhaba');

      expect(grantInvitesMock).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        3,
      );
    });

    it('ikinci_cekirdek_odaya_da_mesaj_olusturabilir', async () => {
      const created = {
        id: 'msg-2',
        content: 'meta selam',
        createdAt: new Date('2026-01-01'),
        roomId: otherRoom.id,
        author: { username: 'dev' },
      };
      const { prismaMock, findUniqueSpy, createSpy } =
        buildSendMessagePrismaMock(otherRoom, created);

      const service = buildService(prismaMock);
      const result = await service.sendMessage(
        'user-1',
        CORE_ROOM_NAMES[1],
        'meta selam',
      );

      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: { name: CORE_ROOM_NAMES[1] },
      });
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            content: 'meta selam',
            roomId: otherRoom.id,
            authorId: 'user-1',
          },
        }),
      );
      expect(result.roomId).toBe(otherRoom.id);
    });

    it('reddeder_oda_bulunamazsa', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.sendMessage('user-1', CORE_ROOM_NAMES[0], 'merhaba'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reddeder_arsivlenmis_odaya_mesaji_gone_ile', async () => {
      const archivedRoom = { ...room, status: 'archived' };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(archivedRoom),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.sendMessage('user-1', CORE_ROOM_NAMES[0], 'merhaba'),
      ).rejects.toThrow(GoneException);
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
          author: { username: 'dev' },
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
        CORE_ROOM_NAMES[0],
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
        CORE_ROOM_NAMES[0],
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

    it('arsivlenmis_odada_lastViewedAti_damgalar', async () => {
      const archivedRoom = { ...room, status: 'archived' };
      const findManyMock = jest.fn().mockResolvedValue([]);
      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(archivedRoom),
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      const before = Date.now();
      await service.getRecentMessages(CORE_ROOM_NAMES[0], 'requester-1');
      const after = Date.now();

      expect(updateManyMock).toHaveBeenCalledTimes(1);
      const call = updateManyMock.mock.calls[0] as [
        { where: { id: string }; data: { lastViewedAt: Date } },
      ];
      expect(call[0].where).toEqual({ id: archivedRoom.id });
      const stamped = call[0].data.lastViewedAt.getTime();
      expect(stamped).toBeGreaterThanOrEqual(before);
      expect(stamped).toBeLessThanOrEqual(after);
    });

    it('aktif_odada_lastViewedAti_hic_damgalamaz', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const updateManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
        message: {
          findMany: findManyMock,
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);
      await service.getRecentMessages(CORE_ROOM_NAMES[0], 'requester-1');

      expect(updateManyMock).not.toHaveBeenCalled();
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
      await service.getRecentMessages(CORE_ROOM_NAMES[0], 'requester-1');

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
      await service.getRecentMessages(CORE_ROOM_NAMES[0], 'requester-1');

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: room.id },
        }),
      );
    });
  });

  describe('editMessage', () => {
    function buildTransactionalPrismaMock(
      existingMessage: {
        id: string;
        content: string;
        authorId: string | null;
        room?: { status: string };
      },
      updated: unknown,
    ): {
      prismaMock: Partial<PrismaService>;
      createSpy: jest.Mock;
      updateSpy: jest.Mock;
    } {
      const createSpy = jest.fn().mockResolvedValue({});
      const updateSpy = jest.fn().mockResolvedValue(updated);
      const txMock = {
        messageEdit: { create: createSpy },
        message: { update: updateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue({
            room: { status: 'active' },
            ...existingMessage,
          }),
        } as unknown as PrismaService['message'],
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      return { prismaMock, createSpy, updateSpy };
    }

    it('yazari_icerigi_gunceller_ve_eski_icerigi_gecmise_yazar', async () => {
      const existing = {
        id: 'msg-1',
        content: 'eski icerik',
        authorId: 'user-1',
      };
      const updated = {
        id: 'msg-1',
        content: 'yeni icerik',
        createdAt: new Date('2026-01-01'),
        roomId: room.id,
        author: { username: 'dev' },
      };
      const { prismaMock, createSpy, updateSpy } = buildTransactionalPrismaMock(
        existing,
        updated,
      );

      const service = buildService(prismaMock);
      const result = await service.editMessage(
        'user-1',
        'msg-1',
        'yeni icerik',
      );

      expect(createSpy).toHaveBeenCalledWith({
        data: { messageId: 'msg-1', previousContent: 'eski icerik' },
      });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: { content: 'yeni icerik' },
        }),
      );
      expect(result.content).toBe('yeni icerik');
    });

    it('reddeder_yazari_olmayan_kullaniciyi', async () => {
      const existing = {
        id: 'msg-1',
        content: 'eski icerik',
        authorId: 'user-1',
      };
      const { prismaMock } = buildTransactionalPrismaMock(existing, {});

      const service = buildService(prismaMock);

      await expect(
        service.editMessage('baska-kullanici', 'msg-1', 'yeni icerik'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reddeder_bilinmeyen_mesaji', async () => {
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.editMessage('user-1', 'yok-mesaj', 'yeni icerik'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reddeder_arsivlenmis_odadaki_duzenlemeyi_gone_ile_yazar_olsa_bile', async () => {
      const existing = {
        id: 'msg-1',
        content: 'eski icerik',
        authorId: 'user-1',
        room: { status: 'archived' },
      };
      const { prismaMock } = buildTransactionalPrismaMock(existing, {});

      const service = buildService(prismaMock);

      await expect(
        service.editMessage('user-1', 'msg-1', 'yeni icerik'),
      ).rejects.toThrow(GoneException);
    });
  });

  describe('getMessageEditHistory', () => {
    const edits = [
      {
        id: 'edit-1',
        previousContent: 'ilk hal',
        editedAt: new Date('2026-01-01'),
      },
      {
        id: 'edit-2',
        previousContent: 'ikinci hal',
        editedAt: new Date('2026-01-02'),
      },
    ];

    it('yazarin_kendi_gecmisini_gormesine_izin_verir', async () => {
      const findManyMock = jest.fn().mockResolvedValue(edits);
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'msg-1', authorId: 'user-1' }),
        } as unknown as PrismaService['message'],
        messageEdit: {
          findMany: findManyMock,
        } as unknown as PrismaService['messageEdit'],
      };

      const service = buildService(prismaMock);
      const result = await service.getMessageEditHistory('user-1', 'msg-1');

      expect(findManyMock).toHaveBeenCalledWith({
        where: { messageId: 'msg-1' },
        orderBy: { editedAt: 'asc' },
      });
      expect(result).toEqual([
        { previousContent: 'ilk hal', editedAt: edits[0].editedAt },
        { previousContent: 'ikinci hal', editedAt: edits[1].editedAt },
      ]);
    });

    it('moderatorun_baskasinin_gecmisini_gormesine_izin_verir', async () => {
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'msg-1', authorId: 'yazar-1' }),
        } as unknown as PrismaService['message'],
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: 'moderator' }),
        } as unknown as PrismaService['user'],
        messageEdit: {
          findMany: jest.fn().mockResolvedValue([]),
        } as unknown as PrismaService['messageEdit'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.getMessageEditHistory('moderator-1', 'msg-1'),
      ).resolves.toEqual([]);
    });

    it('reddeder_ne_yazar_ne_moderator_olan_kullaniciyi', async () => {
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'msg-1', authorId: 'yazar-1' }),
        } as unknown as PrismaService['message'],
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: 'user' }),
        } as unknown as PrismaService['user'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.getMessageEditHistory('baska-kullanici', 'msg-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reddeder_bilinmeyen_mesaji', async () => {
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.getMessageEditHistory('user-1', 'yok-mesaj'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
