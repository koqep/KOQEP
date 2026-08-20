import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RoomModerationService,
  ROOM_RENAMED_ACTION,
  ROOM_ARCHIVED_ACTION,
  ROOM_DELETED_ACTION,
  ROOM_ANNOUNCEMENT_UPDATED_ACTION,
} from './room-moderation.service';
import { PrismaService } from '../db/prisma.service';

describe('RoomModerationService', () => {
  function buildTransactionMock(txMock: unknown): jest.Mock {
    return jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock));
  }

  describe('renameRoom', () => {
    it('ismi_gunceller_ve_eski_ismi_denetim_satirina_yazar', async () => {
      const room = {
        id: 'room-1',
        name: 'eski-isim',
        description: 'bir aciklama',
        status: 'active',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'yeni-isim',
        description: 'bir aciklama',
        lastActivityAt: new Date(),
        status: 'active',
      });
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: auditCreateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
          findFirst: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.renameRoom(
        'moderator-1',
        'room-1',
        'yeni-isim',
      );

      expect(roomUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { name: 'yeni-isim' },
        }),
      );
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: ROOM_RENAMED_ACTION,
          targetRoomId: 'room-1',
          targetRoomName: 'eski-isim',
          targetRoomDescription: 'bir aciklama',
        },
      });
      expect(result.name).toBe('yeni-isim');
    });

    it('kendi_mevcut_ismine_buyuk_kucuk_harf_varyasyonuyla_yeniden_adlandirma_cakismaz', async () => {
      const room = {
        id: 'room-1',
        name: 'myroom',
        description: null,
        status: 'active',
      };
      const findFirstMock = jest.fn().mockResolvedValue(null);
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'MyRoom',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
      });
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
          findFirst: findFirstMock,
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      await service.renameRoom('moderator-1', 'room-1', 'MyRoom');

      expect(findFirstMock).toHaveBeenCalledWith({
        where: {
          name: { equals: 'MyRoom', mode: 'insensitive' },
          id: { not: 'room-1' },
        },
      });
      expect(roomUpdateSpy).toHaveBeenCalled();
    });

    it('baska_bir_odayla_isim_cakismasinda_conflict_atar', async () => {
      const room = {
        id: 'room-1',
        name: 'eski-isim',
        description: null,
        status: 'active',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
          findFirst: jest.fn().mockResolvedValue({ id: 'room-2' }),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.renameRoom('moderator-1', 'room-1', 'baska-oda'),
      ).rejects.toThrow(ConflictException);
    });

    it('arsivlenmis_bir_oda_da_yeniden_adlandirilabilir', async () => {
      const room = {
        id: 'room-1',
        name: 'eski-isim',
        description: null,
        status: 'archived',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'yeni-isim',
        description: null,
        lastActivityAt: new Date(),
        status: 'archived',
      });
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
          findFirst: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.renameRoom(
        'moderator-1',
        'room-1',
        'yeni-isim',
      );

      expect(roomUpdateSpy).toHaveBeenCalled();
      expect(result.name).toBe('yeni-isim');
    });

    it('cekirdek_odayi_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'general',
        description: null,
        status: 'active',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.renameRoom('moderator-1', 'room-1', 'yeni-isim'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reddeder_bilinmeyen_odayi', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.renameRoom('moderator-1', 'yok-oda', 'yeni-isim'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveRoom', () => {
    it('aktif_odayi_arsivler_ve_denetim_satiri_yazar', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: null,
        status: 'active',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'archived',
      });
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: auditCreateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.archiveRoom('moderator-1', 'room-1');

      const call = roomUpdateSpy.mock.calls[0] as [
        { where: { id: string }; data: { status: string } },
      ];
      expect(call[0].where).toEqual({ id: 'room-1' });
      expect(call[0].data.status).toBe('archived');
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: ROOM_ARCHIVED_ACTION,
          targetRoomId: 'room-1',
          targetRoomName: 'oda',
          targetRoomDescription: null,
        },
      });
      expect(result.status).toBe('archived');
    });

    it('zaten_aktif_olmayan_odayi_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: null,
        status: 'archived',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.archiveRoom('moderator-1', 'room-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('cekirdek_odayi_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'meta',
        description: null,
        status: 'active',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.archiveRoom('moderator-1', 'room-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRoom', () => {
    function buildDeleteTxMock(): {
      txMock: unknown;
      reportUpdateManySpy: jest.Mock;
      messageEditDeleteManySpy: jest.Mock;
      messageDeleteManySpy: jest.Mock;
      auditCreateSpy: jest.Mock;
      roomDeleteSpy: jest.Mock;
    } {
      const reportUpdateManySpy = jest.fn().mockResolvedValue({ count: 2 });
      const messageEditDeleteManySpy = jest
        .fn()
        .mockResolvedValue({ count: 3 });
      const messageDeleteManySpy = jest.fn().mockResolvedValue({ count: 5 });
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const roomDeleteSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        report: { updateMany: reportUpdateManySpy },
        messageEdit: { deleteMany: messageEditDeleteManySpy },
        message: { deleteMany: messageDeleteManySpy },
        moderationAuditLog: { create: auditCreateSpy },
        room: { delete: roomDeleteSpy },
      };
      return {
        txMock,
        reportUpdateManySpy,
        messageEditDeleteManySpy,
        messageDeleteManySpy,
        auditCreateSpy,
        roomDeleteSpy,
      };
    }

    it('arsivlenmis_odayi_siler_acik_raporlari_cozer_ve_denetim_satiri_yazar', async () => {
      const room = {
        id: 'room-1',
        name: 'kotu-oda',
        description: 'aciklama',
        status: 'archived',
      };
      const {
        txMock,
        reportUpdateManySpy,
        messageEditDeleteManySpy,
        messageDeleteManySpy,
        auditCreateSpy,
        roomDeleteSpy,
      } = buildDeleteTxMock();
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.deleteRoom('moderator-1', 'room-1');

      expect(reportUpdateManySpy).toHaveBeenCalledWith({
        where: { message: { roomId: 'room-1' }, status: 'open' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedById: 'moderator-1',
        }) as Prisma.ReportUpdateManyMutationInput,
      });
      expect(messageEditDeleteManySpy).toHaveBeenCalledWith({
        where: { message: { roomId: 'room-1' } },
      });
      expect(messageDeleteManySpy).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
      });
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: ROOM_DELETED_ACTION,
          targetRoomId: 'room-1',
          targetRoomName: 'kotu-oda',
          targetRoomDescription: 'aciklama',
          deletedMessageCount: 5,
        },
      });
      expect(roomDeleteSpy).toHaveBeenCalledWith({ where: { id: 'room-1' } });
      expect(result.deletedMessageCount).toBe(5);
    });

    it('arsivlenmemis_odayi_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: null,
        status: 'active',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(service.deleteRoom('moderator-1', 'room-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cekirdek_odayi_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'general',
        description: null,
        status: 'archived',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(service.deleteRoom('moderator-1', 'room-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reddeder_bilinmeyen_odayi', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.deleteRoom('moderator-1', 'yok-oda'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setRoomAnnouncement', () => {
    it('duyuruyu_ayarlar_ve_denetim_satirina_yazar', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: 'aciklama',
        status: 'active',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'oda',
        description: 'aciklama',
        lastActivityAt: new Date(),
        status: 'active',
        announcement: 'Faz 1e hos geldiniz!',
      });
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: auditCreateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.setRoomAnnouncement(
        'moderator-1',
        'room-1',
        'Faz 1e hos geldiniz!',
      );

      expect(roomUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { announcement: 'Faz 1e hos geldiniz!' },
        }),
      );
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: ROOM_ANNOUNCEMENT_UPDATED_ACTION,
          targetRoomId: 'room-1',
          targetRoomName: 'oda',
          targetRoomDescription: 'aciklama',
          targetRoomAnnouncement: 'Faz 1e hos geldiniz!',
        },
      });
      expect(result.announcement).toBe('Faz 1e hos geldiniz!');
    });

    it('bos_metinle_cagrilinca_duyuruyu_temizler', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: null,
        status: 'active',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        announcement: null,
      });
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: auditCreateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      await service.setRoomAnnouncement('moderator-1', 'room-1', '   ');

      expect(roomUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: { announcement: null } }),
      );
      expect(auditCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetRoomAnnouncement: null,
          }) as Prisma.ModerationAuditLogUncheckedCreateInput,
        }),
      );
    });

    // rename/archive/delete'in "çekirdek odayı reddeder" testlerinin TERSİ -
    // çekirdek odalar (general/meta) tam da founder'ın duyuru pinleyeceği
    // yerler, buraya kısıt UYGULANMAMASI bilerek.
    it('cekirdek_odaya_da_duyuru_konabilir', async () => {
      const room = {
        id: 'room-1',
        name: 'general',
        description: null,
        status: 'active',
      };
      const roomUpdateSpy = jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'general',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        announcement: 'bir duyuru',
      });
      const txMock = {
        room: { update: roomUpdateSpy },
        moderationAuditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        $transaction: buildTransactionMock(txMock),
      };

      const service = new RoomModerationService(prismaMock as PrismaService);
      const result = await service.setRoomAnnouncement(
        'moderator-1',
        'room-1',
        'bir duyuru',
      );

      expect(roomUpdateSpy).toHaveBeenCalled();
      expect(result.announcement).toBe('bir duyuru');
    });

    it('zalgo_icerikli_duyuruyu_reddeder', async () => {
      const room = {
        id: 'room-1',
        name: 'oda',
        description: null,
        status: 'active',
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
      };
      const zalgo = 'z' + '́'.repeat(20) + ' duyuru';

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.setRoomAnnouncement('moderator-1', 'room-1', zalgo),
      ).rejects.toThrow(BadRequestException);
    });

    it('reddeder_bilinmeyen_odayi', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['room'],
      };

      const service = new RoomModerationService(prismaMock as PrismaService);

      await expect(
        service.setRoomAnnouncement('moderator-1', 'yok-oda', 'bir duyuru'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
