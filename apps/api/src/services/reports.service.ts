import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Report } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { MessagesService, MessageDto } from './messages.service';

export const REPORT_QUEUE_VIEWED_ACTION = 'REPORT_QUEUE_VIEWED';
export const CONTENT_REMOVED_ACTION = 'CONTENT_REMOVED';
export const REPORT_DISMISSED_ACTION = 'REPORT_DISMISSED';

// M5 Slice C: aynı-aktör çoklu-rapor tespiti - tahmini, sonradan
// ayarlanabilir (bu kod tabanının diğer sayısal sabitleriyle, ör. XP
// formülü/mute süresi/rate limit'ler, AYNI ilke). Tek-moderatörlü bir
// toplulukta kuyruk günlük kontrol edilmeyebilir diye pencere geniş
// tutuldu (7 gün) - sayım zaten SADECE açık raporları kapsadığı için
// "eski gürültü" riski düşük.
export const MULTI_REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MULTI_REPORT_THRESHOLD = 3;

// TASARIM KURALI: isFlagged/distinctReporterCount SADECE bilgi/görünürlük
// sinyalidir - hiçbir kod yolu buna dayanarak otomatik bir moderatör
// aksiyonu (susturma, içerik kaldırma) TETİKLEMEMELİ. docs/THREAT-MODEL.md
// satır 7 zaten kabul ediyor ki 20-30 kişilik bir toplulukta 3 kişi
// anlaşıp masum birini flag'letebilir (brigading) - otomatik bir tepki bu
// riski bir SİLAHA çevirir. Karar HER ZAMAN insan moderatöre bırakılır.

export interface ReportSummary {
  id: string;
  createdAt: Date;
  reason: string | null;
  reportedContent: string;
  reportedUsername: string | null;
  reportedUserId: string | null;
  // MULTI_REPORT_WINDOW_MS içinde bu kullanıcıya karşı açılmış,
  // BİRBİRİNDEN FARKLI raporcu sayısı - tüm-zamanlar sayısı DEĞİL.
  // isFlagged bu sayı MULTI_REPORT_THRESHOLD'a ulaşınca true olur.
  distinctReporterCount: number;
  isFlagged: boolean;
}

export interface ResolveReportResult {
  dto: MessageDto;
  authorId: string | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async createReport(
    reporterId: string,
    messageId: string,
    reason?: string,
  ): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException(`Mesaj bulunamadı: ${messageId}`);
    }
    // M5 Slice C: kendine izin vermenin hiçbir meşru kullanım senaryosu
    // yok, kuyruğu gereksiz kirletir ve çoklu-rapor sinyalinin kalitesini
    // bozar.
    if (message.authorId === reporterId) {
      throw new ForbiddenException('Kendi mesajını raporlayamazsın.');
    }

    // reportedContent VE reportedUserId burada SNAPSHOT'lanır - raporlanan
    // kullanıcı moderatör bakmadan önce mesajını editMessage ile
    // değiştirebilir ya da hesabını silebilir, bu iki alan kanıtı hayatta
    // tutuyor (bkz. schema.prisma'daki yorumlar).
    await this.prisma.report.create({
      data: {
        reporterId,
        messageId,
        reportedUserId: message.authorId,
        reportedContent: message.content,
        reason,
      },
    });
  }

  // Her çağrı TEK bir ModerationAuditLog satırı yazar ("kuyruk
  // görüntülendi") - rapor başına değil, panel bileşenlerinin (ör.
  // InviteView.tsx) her mount'ta yeniden çekme deseniyle birleşince
  // gürültü üretmesin diye.
  async listOpenReports(moderatorId: string): Promise<ReportSummary[]> {
    const reports = await this.prisma.report.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
      include: { reportedUser: { select: { username: true } } },
    });

    if (reports.length > 0) {
      await this.prisma.moderationAuditLog.create({
        data: { moderatorId, actionType: REPORT_QUEUE_VIEWED_ACTION },
      });
    }

    const flagCounts = this.countDistinctReportersByTarget(reports);

    return reports.map((report) => {
      // Sayım PENCERE İÇİNDEKİ raporlarla yapılıyor ama sonuç o
      // reportedUserId'ye ait TÜM açık rapor satırlarına uygulanıyor
      // (pencere dışındakiler dahil) - flag KİŞİ hakkında bir sinyal, o
      // spesifik rapor hakkında değil.
      const distinctReporterCount = report.reportedUserId
        ? (flagCounts.get(report.reportedUserId) ?? 0)
        : 0;
      return {
        id: report.id,
        createdAt: report.createdAt,
        reason: report.reason,
        reportedContent: report.reportedContent,
        reportedUsername: report.reportedUser?.username ?? null,
        reportedUserId: report.reportedUserId,
        distinctReporterCount,
        isFlagged: distinctReporterCount >= MULTI_REPORT_THRESHOLD,
      };
    });
  }

  async removeContent(
    moderatorId: string,
    reportId: string,
  ): Promise<ResolveReportResult> {
    const report = await this.findOpenReportOrThrow(reportId);
    if (!report.messageId) {
      // Mesaj arşivlenmiş bir odanın purge'ünde silinmiş olabilir (M3
      // Slice C) - reportedContent/reportedUserId snapshot'ları hâlâ
      // okunabilir ama artık üzerinde aksiyon alınacak canlı bir mesaj yok.
      throw new ConflictException(
        'Bu raporun bağlı olduğu mesaj artık mevcut değil.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await this.messagesService.removeMessageContent(
        tx,
        report.messageId as string,
      );
      // Rapor hâlâ 'open' iken (tx.report.update'ten ÖNCE) sayılıyor - bu
      // raporun kendisi de sayıma dahil olarak "karar anındaki gerçek
      // durum" yakalanıyor.
      const distinctReporterCountAtResolution = report.reportedUserId
        ? await this.countDistinctReportersForTarget(tx, report.reportedUserId)
        : null;
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: 'resolved',
          resolvedById: moderatorId,
          resolvedAt: new Date(),
        },
      });
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: CONTENT_REMOVED_ACTION,
          targetMessageId: report.messageId,
          reportId,
          distinctReporterCountAtResolution,
        },
      });
      return result;
    });
  }

  async dismiss(moderatorId: string, reportId: string): Promise<void> {
    const report = await this.findOpenReportOrThrow(reportId);

    // dismiss önceden array-form $transaction kullanıyordu - sayımın rapor
    // hâlâ 'open' iken, aynı transaction içinde okunabilmesi için
    // callback-form'a çevrildi (removeContent'in zaten kullandığı desen).
    await this.prisma.$transaction(async (tx) => {
      const distinctReporterCountAtResolution = report.reportedUserId
        ? await this.countDistinctReportersForTarget(tx, report.reportedUserId)
        : null;
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: 'dismissed',
          resolvedById: moderatorId,
          resolvedAt: new Date(),
        },
      });
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: REPORT_DISMISSED_ACTION,
          reportId,
          distinctReporterCountAtResolution,
        },
      });
    });
  }

  private async findOpenReportOrThrow(reportId: string): Promise<Report> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException(`Rapor bulunamadı: ${reportId}`);
    }
    if (report.status !== 'open') {
      throw new ConflictException('Bu rapor zaten çözülmüş.');
    }
    return report;
  }

  // M5 Slice C: listOpenReports'un TEK geçişte tüm hedefler için sayması -
  // reportedUserId VE reporterId ikisi de null olabilir (AuthService.
  // deleteAccount()'un onDelete:SetNull'ü), ikisi de atlanmazsa sayı ya
  // yanlışlıkla azalır (birden fazla silinmiş-hesaplı raporcu tek bir
  // null'a çöker) ya da null "hayalet" bir raporcu gibi sayılır.
  private countDistinctReportersByTarget(
    reports: {
      reportedUserId: string | null;
      reporterId: string | null;
      createdAt: Date;
    }[],
  ): Map<string, number> {
    const windowStart = new Date(Date.now() - MULTI_REPORT_WINDOW_MS);
    const reportersByTarget = new Map<string, Set<string>>();
    for (const report of reports) {
      if (!report.reportedUserId || !report.reporterId) continue;
      if (report.createdAt < windowStart) continue;
      const set =
        reportersByTarget.get(report.reportedUserId) ?? new Set<string>();
      set.add(report.reporterId);
      reportersByTarget.set(report.reportedUserId, set);
    }
    const counts = new Map<string, number>();
    for (const [targetId, reporterSet] of reportersByTarget) {
      counts.set(targetId, reporterSet.size);
    }
    return counts;
  }

  // removeContent/dismiss'in "karar anındaki" tekli-hedef versiyonu -
  // countDistinctReportersByTarget'ın aksine zaten bellekte bir rapor
  // listesi yok, tek bir hedef için taze bir sorgu gerekiyor.
  private async countDistinctReportersForTarget(
    tx: Prisma.TransactionClient,
    reportedUserId: string,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - MULTI_REPORT_WINDOW_MS);
    const openReports = await tx.report.findMany({
      where: {
        reportedUserId,
        status: 'open',
        createdAt: { gte: windowStart },
      },
      select: { reporterId: true },
    });
    const distinctReporterIds = new Set(
      openReports
        .map((r) => r.reporterId)
        .filter((id): id is string => id !== null),
    );
    return distinctReporterIds.size;
  }
}
