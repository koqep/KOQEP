import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ReportsService,
  CONTENT_REMOVED_ACTION,
  REPORT_DISMISSED_ACTION,
  REPORT_QUEUE_VIEWED_ACTION,
} from './reports.service';
import { PrismaService } from '../db/prisma.service';
import { MessagesService } from './messages.service';

describe('ReportsService', () => {
  function buildService(
    prismaMock: Partial<PrismaService>,
    messagesServiceMock: Partial<MessagesService> = {},
  ): ReportsService {
    return new ReportsService(
      prismaMock as PrismaService,
      messagesServiceMock as MessagesService,
    );
  }

  describe('createReport', () => {
    it('mesajin_o_anki_icerigini_ve_yazarini_snapshotlar', async () => {
      const message = {
        id: 'msg-1',
        content: 'saldirgan icerik',
        authorId: 'yazar-1',
      };
      const createSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue(message),
        } as unknown as PrismaService['message'],
        report: {
          create: createSpy,
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);
      await service.createReport('reporter-1', 'msg-1', 'kötüye kullanım');

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          reporterId: 'reporter-1',
          messageId: 'msg-1',
          reportedUserId: 'yazar-1',
          reportedContent: 'saldirgan icerik',
          reason: 'kötüye kullanım',
        },
      });
    });

    it('reddeder_bilinmeyen_mesaji', async () => {
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.createReport('reporter-1', 'yok-mesaj'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listOpenReports', () => {
    it('sadece_acik_raporlari_doner_ve_tek_denetim_satiri_yazar', async () => {
      const reports = [
        {
          id: 'report-1',
          createdAt: new Date('2026-01-01'),
          reason: null,
          reportedContent: 'icerik 1',
          reportedUser: { username: 'saldirgan' },
        },
      ];
      const findManyMock = jest.fn().mockResolvedValue(reports);
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        report: {
          findMany: findManyMock,
        } as unknown as PrismaService['report'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
      };

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'open' } }),
      );
      expect(auditCreateMock).toHaveBeenCalledTimes(1);
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: REPORT_QUEUE_VIEWED_ACTION,
        },
      });
      expect(result).toEqual([
        {
          id: 'report-1',
          createdAt: reports[0].createdAt,
          reason: null,
          reportedContent: 'icerik 1',
          reportedUsername: 'saldirgan',
        },
      ]);
    });

    it('bos_kuyrukta_denetim_satiri_yazmaz', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        report: {
          findMany: findManyMock,
        } as unknown as PrismaService['report'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
      };

      const service = buildService(prismaMock);
      await service.listOpenReports('moderator-1');

      expect(auditCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('removeContent', () => {
    function buildTxMock(report: unknown): {
      prismaMock: Partial<PrismaService>;
      reportUpdateSpy: jest.Mock;
      auditCreateSpy: jest.Mock;
    } {
      const reportUpdateSpy = jest.fn().mockResolvedValue({});
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const txMock = {
        report: { update: reportUpdateSpy },
        moderationAuditLog: { create: auditCreateSpy },
      };
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest.fn().mockResolvedValue(report),
        } as unknown as PrismaService['report'],
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      return { prismaMock, reportUpdateSpy, auditCreateSpy };
    }

    it('mesaj_icerigini_kaldirir_raporu_cozer_ve_denetim_satiri_yazar', async () => {
      const report = { id: 'report-1', status: 'open', messageId: 'msg-1' };
      const removeMessageContentMock = jest.fn().mockResolvedValue({
        dto: { id: 'msg-1', content: '[kaldırıldı]' },
        authorId: 'yazar-1',
      });
      const { prismaMock, reportUpdateSpy, auditCreateSpy } =
        buildTxMock(report);

      const service = buildService(prismaMock, {
        removeMessageContent: removeMessageContentMock,
      });
      const result = await service.removeContent('moderator-1', 'report-1');

      expect(removeMessageContentMock).toHaveBeenCalledWith(
        expect.anything(),
        'msg-1',
      );
      expect(reportUpdateSpy).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedById: 'moderator-1',
        }) as Prisma.ReportUpdateInput,
      });
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: CONTENT_REMOVED_ACTION,
          targetMessageId: 'msg-1',
          reportId: 'report-1',
        },
      });
      expect(result.authorId).toBe('yazar-1');
    });

    it('reddeder_bilinmeyen_raporu', async () => {
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.removeContent('moderator-1', 'yok-rapor'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reddeder_zaten_cozulmus_raporu', async () => {
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'report-1', status: 'resolved' }),
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.removeContent('moderator-1', 'report-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('mesaji_purge_edilmis_raporu_conflict_ile_reddeder', async () => {
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'report-1',
            status: 'open',
            messageId: null,
          }),
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.removeContent('moderator-1', 'report-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('dismiss', () => {
    it('raporu_reddedildi_olarak_isaretler_ve_denetim_satiri_yazar', async () => {
      const report = { id: 'report-1', status: 'open', messageId: 'msg-1' };
      const transactionMock = jest
        .fn()
        .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
      const reportUpdateMock = jest.fn().mockResolvedValue({});
      const auditCreateMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest.fn().mockResolvedValue(report),
          update: reportUpdateMock,
        } as unknown as PrismaService['report'],
        moderationAuditLog: {
          create: auditCreateMock,
        } as unknown as PrismaService['moderationAuditLog'],
        $transaction: transactionMock,
      };

      const service = buildService(prismaMock);
      await service.dismiss('moderator-1', 'report-1');

      expect(reportUpdateMock).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: 'dismissed',
          resolvedById: 'moderator-1',
        }) as Prisma.ReportUpdateInput,
      });
      expect(auditCreateMock).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: REPORT_DISMISSED_ACTION,
          reportId: 'report-1',
        },
      });
    });

    it('reddeder_zaten_cozulmus_raporu', async () => {
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'report-1', status: 'dismissed' }),
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);

      await expect(service.dismiss('moderator-1', 'report-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
