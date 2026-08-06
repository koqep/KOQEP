import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Report } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { MessagesService, MessageDto } from './messages.service';

export const REPORT_QUEUE_VIEWED_ACTION = 'REPORT_QUEUE_VIEWED';
export const CONTENT_REMOVED_ACTION = 'CONTENT_REMOVED';
export const REPORT_DISMISSED_ACTION = 'REPORT_DISMISSED';

export interface ReportSummary {
  id: string;
  createdAt: Date;
  reason: string | null;
  reportedContent: string;
  reportedUsername: string | null;
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

    return reports.map((report) => ({
      id: report.id,
      createdAt: report.createdAt,
      reason: report.reason,
      reportedContent: report.reportedContent,
      reportedUsername: report.reportedUser?.username ?? null,
    }));
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
        },
      });
      return result;
    });
  }

  async dismiss(moderatorId: string, reportId: string): Promise<void> {
    await this.findOpenReportOrThrow(reportId);

    await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'dismissed',
          resolvedById: moderatorId,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.moderationAuditLog.create({
        data: { moderatorId, actionType: REPORT_DISMISSED_ACTION, reportId },
      }),
    ]);
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
}
