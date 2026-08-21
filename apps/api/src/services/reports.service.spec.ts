import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ReportsService,
  CONTENT_REMOVED_ACTION,
  REPORT_DISMISSED_ACTION,
  REPORT_QUEUE_VIEWED_ACTION,
  MULTI_REPORT_WINDOW_MS,
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

    it('reddeder_kendi_mesajini_raporlamayi', async () => {
      const message = {
        id: 'msg-1',
        content: 'kendi mesajim',
        authorId: 'user-1',
      };
      const prismaMock: Partial<PrismaService> = {
        message: {
          findUnique: jest.fn().mockResolvedValue(message),
        } as unknown as PrismaService['message'],
      };

      const service = buildService(prismaMock);

      await expect(service.createReport('user-1', 'msg-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('listOpenReports', () => {
    function buildListMock(reports: unknown[]): {
      prismaMock: Partial<PrismaService>;
      findManyMock: jest.Mock;
      auditCreateMock: jest.Mock;
    } {
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
      return { prismaMock, findManyMock, auditCreateMock };
    }

    it('sadece_acik_raporlari_doner_ve_tek_denetim_satiri_yazar', async () => {
      const reports = [
        {
          id: 'report-1',
          createdAt: new Date(),
          reason: null,
          reportedContent: 'icerik 1',
          reportedUserId: 'saldirgan-1',
          reporterId: 'reporter-1',
          reportedUser: { username: 'saldirgan' },
        },
      ];
      const { prismaMock, findManyMock, auditCreateMock } =
        buildListMock(reports);

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
          reportedUserId: 'saldirgan-1',
          distinctReporterCount: 1,
          isFlagged: false,
        },
      ]);
    });

    it('bos_kuyrukta_denetim_satiri_yazmaz', async () => {
      const { prismaMock, auditCreateMock } = buildListMock([]);

      const service = buildService(prismaMock);
      await service.listOpenReports('moderator-1');

      expect(auditCreateMock).not.toHaveBeenCalled();
    });

    it('uc_farkli_raporcu_esigi_gecince_isFlagged_true_doner', async () => {
      const now = new Date();
      const reports = ['a', 'b', 'c'].map((reporter, i) => ({
        id: `report-${i}`,
        createdAt: now,
        reason: null,
        reportedContent: `icerik ${i}`,
        reportedUserId: 'saldirgan-1',
        reporterId: `reporter-${reporter}`,
        reportedUser: { username: 'saldirgan' },
      }));
      const { prismaMock } = buildListMock(reports);

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      expect(result.every((r) => r.isFlagged)).toBe(true);
      expect(result.every((r) => r.distinctReporterCount === 3)).toBe(true);
    });

    it('iki_farkli_raporcu_esigi_gecmez', async () => {
      const now = new Date();
      const reports = ['a', 'b'].map((reporter, i) => ({
        id: `report-${i}`,
        createdAt: now,
        reason: null,
        reportedContent: `icerik ${i}`,
        reportedUserId: 'saldirgan-1',
        reporterId: `reporter-${reporter}`,
        reportedUser: { username: 'saldirgan' },
      }));
      const { prismaMock } = buildListMock(reports);

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      expect(result.every((r) => !r.isFlagged)).toBe(true);
      expect(result.every((r) => r.distinctReporterCount === 2)).toBe(true);
    });

    it('ayni_raporcunun_farkli_mesajlari_raporlamasi_tekillestirilir', async () => {
      const now = new Date();
      const reports = [0, 1, 2].map((i) => ({
        id: `report-${i}`,
        createdAt: now,
        reason: null,
        reportedContent: `icerik ${i}`,
        reportedUserId: 'saldirgan-1',
        reporterId: 'ayni-raporcu',
        reportedUser: { username: 'saldirgan' },
      }));
      const { prismaMock } = buildListMock(reports);

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      expect(result.every((r) => !r.isFlagged)).toBe(true);
      expect(result.every((r) => r.distinctReporterCount === 1)).toBe(true);
    });

    it('pencere_disindaki_eski_rapor_sayima_katilmaz_ama_flagli_kisinin_eski_raporu_da_isFlagged_gorunur', async () => {
      const now = new Date();
      const outsideWindow = new Date(
        now.getTime() - MULTI_REPORT_WINDOW_MS - 1000,
      );
      const reports = [
        {
          id: 'old-report',
          createdAt: outsideWindow,
          reason: null,
          reportedContent: 'eski icerik',
          reportedUserId: 'saldirgan-1',
          reporterId: 'reporter-eski',
          reportedUser: { username: 'saldirgan' },
        },
        ...['a', 'b', 'c'].map((reporter, i) => ({
          id: `fresh-report-${i}`,
          createdAt: now,
          reason: null,
          reportedContent: `icerik ${i}`,
          reportedUserId: 'saldirgan-1',
          reporterId: `reporter-${reporter}`,
          reportedUser: { username: 'saldirgan' },
        })),
      ];
      const { prismaMock } = buildListMock(reports);

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      // Pencere dışındaki raporcu (reporter-eski) sayıya KATILMADI (3, 4
      // değil) ama flag KİŞİ hakkında olduğu için eski rapor satırı da
      // isFlagged:true gösteriyor.
      expect(result.every((r) => r.distinctReporterCount === 3)).toBe(true);
      expect(result.every((r) => r.isFlagged)).toBe(true);
    });

    it('null_reportedUserId_ve_reporterId_cokmeden_atlanir', async () => {
      const now = new Date();
      const reports = [
        {
          id: 'report-1',
          createdAt: now,
          reason: null,
          reportedContent: 'icerik',
          reportedUserId: null,
          reporterId: 'reporter-1',
          reportedUser: null,
        },
        {
          id: 'report-2',
          createdAt: now,
          reason: null,
          reportedContent: 'icerik',
          reportedUserId: 'saldirgan-1',
          reporterId: null,
          reportedUser: { username: 'saldirgan' },
        },
      ];
      const { prismaMock } = buildListMock(reports);

      const service = buildService(prismaMock);
      const result = await service.listOpenReports('moderator-1');

      expect(result).toHaveLength(2);
      expect(result.every((r) => !r.isFlagged)).toBe(true);
      expect(result.every((r) => r.distinctReporterCount === 0)).toBe(true);
    });
  });

  describe('removeContent', () => {
    function buildTxMock(
      report: unknown,
      openReportsForTarget: { reporterId: string | null }[] = [],
    ): {
      prismaMock: Partial<PrismaService>;
      reportUpdateSpy: jest.Mock;
      auditCreateSpy: jest.Mock;
      reportFindManySpy: jest.Mock;
    } {
      const reportUpdateSpy = jest.fn().mockResolvedValue({});
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const reportFindManySpy = jest
        .fn()
        .mockResolvedValue(openReportsForTarget);
      const txMock = {
        report: { update: reportUpdateSpy, findMany: reportFindManySpy },
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
      return { prismaMock, reportUpdateSpy, auditCreateSpy, reportFindManySpy };
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
      const result = await service.removeContent(
        'moderator-1',
        'report-1',
        'kural ihlali',
      );

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
      // report'un reportedUserId'si yok (mock'ta hiç set edilmedi) -
      // distinctReporterCountAtResolution null olmalı, sayım sorgusu hiç
      // tetiklenmemeli.
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: CONTENT_REMOVED_ACTION,
          targetMessageId: 'msg-1',
          reportId: 'report-1',
          distinctReporterCountAtResolution: null,
          reason: 'kural ihlali',
        },
      });
      expect(result.authorId).toBe('yazar-1');
    });

    it('reportedUserId_varsa_karar_anindaki_distinct_raporcu_sayisini_denetim_satirina_yazar', async () => {
      const report = {
        id: 'report-1',
        status: 'open',
        messageId: 'msg-1',
        reportedUserId: 'saldirgan-1',
      };
      const removeMessageContentMock = jest.fn().mockResolvedValue({
        dto: { id: 'msg-1', content: '[kaldırıldı]' },
        authorId: 'saldirgan-1',
      });
      const { prismaMock, auditCreateSpy, reportFindManySpy } = buildTxMock(
        report,
        [{ reporterId: 'a' }, { reporterId: 'b' }, { reporterId: 'a' }],
      );

      const service = buildService(prismaMock, {
        removeMessageContent: removeMessageContentMock,
      });
      await service.removeContent('moderator-1', 'report-1', 'kural ihlali');

      expect(reportFindManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportedUserId: 'saldirgan-1',
            status: 'open',
          }) as Prisma.ReportWhereInput,
        }),
      );
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          distinctReporterCountAtResolution: 2,
        }) as Prisma.ModerationAuditLogUncheckedCreateInput,
      });
    });

    it('reddeder_bilinmeyen_raporu', async () => {
      const prismaMock: Partial<PrismaService> = {
        report: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['report'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.removeContent('moderator-1', 'yok-rapor', 'kural ihlali'),
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
        service.removeContent('moderator-1', 'report-1', 'kural ihlali'),
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
        service.removeContent('moderator-1', 'report-1', 'kural ihlali'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('dismiss', () => {
    function buildTxMock(
      report: unknown,
      openReportsForTarget: { reporterId: string | null }[] = [],
    ): {
      prismaMock: Partial<PrismaService>;
      reportUpdateSpy: jest.Mock;
      auditCreateSpy: jest.Mock;
      reportFindManySpy: jest.Mock;
    } {
      const reportUpdateSpy = jest.fn().mockResolvedValue({});
      const auditCreateSpy = jest.fn().mockResolvedValue({});
      const reportFindManySpy = jest
        .fn()
        .mockResolvedValue(openReportsForTarget);
      const txMock = {
        report: { update: reportUpdateSpy, findMany: reportFindManySpy },
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
      return { prismaMock, reportUpdateSpy, auditCreateSpy, reportFindManySpy };
    }

    it('raporu_reddedildi_olarak_isaretler_ve_denetim_satiri_yazar', async () => {
      const report = { id: 'report-1', status: 'open', messageId: 'msg-1' };
      const { prismaMock, reportUpdateSpy, auditCreateSpy } =
        buildTxMock(report);

      const service = buildService(prismaMock);
      await service.dismiss('moderator-1', 'report-1');

      expect(reportUpdateSpy).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: 'dismissed',
          resolvedById: 'moderator-1',
        }) as Prisma.ReportUpdateInput,
      });
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: {
          moderatorId: 'moderator-1',
          actionType: REPORT_DISMISSED_ACTION,
          reportId: 'report-1',
          distinctReporterCountAtResolution: null,
        },
      });
    });

    it('reportedUserId_varsa_karar_anindaki_distinct_raporcu_sayisini_denetim_satirina_yazar', async () => {
      const report = {
        id: 'report-1',
        status: 'open',
        messageId: 'msg-1',
        reportedUserId: 'saldirgan-1',
      };
      const { prismaMock, auditCreateSpy } = buildTxMock(report, [
        { reporterId: 'a' },
        { reporterId: 'b' },
        { reporterId: 'c' },
      ]);

      const service = buildService(prismaMock);
      await service.dismiss('moderator-1', 'report-1');

      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          distinctReporterCountAtResolution: 3,
        }) as Prisma.ModerationAuditLogUncheckedCreateInput,
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
