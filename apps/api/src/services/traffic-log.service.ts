import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

const RETENTION_MONTHS = 18;

@Injectable()
export class TrafficLogService {
  constructor(private readonly prisma: PrismaService) {}

  // 5651: trafik bilgisi EN AZ 18 ay saklanır, süresiz tutulmaz. TOCTOU/
  // erteleme kavramı YOK (RoomsService.purgeArchivedRooms'un aksine) -
  // TrafficLog append-only bir denetim kaydı, "son görüntülenme" gibi bir
  // reprieve sinyali taşımıyor. Takvim ayı (setMonth) - ARCHIVE_AFTER_MS/
  // DELETE_AFTER_MS'in sabit-gün deseninden BİLEREK farklı, "18 ay" yasal
  // ifadesini tam karşılamak için (kullanıcı onayı).
  async purgeOldRows(
    now: Date = new Date(),
  ): Promise<{ deletedCount: number }> {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

    const result = await this.prisma.trafficLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }
}
