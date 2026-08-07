import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export const MUTE_APPLIED_ACTION = 'MUTE_APPLIED';
export const MUTE_LIFTED_ACTION = 'MUTE_LIFTED';

const HOUR_IN_MS = 60 * 60 * 1000;

@Injectable()
export class MutesService {
  constructor(private readonly prisma: PrismaService) {}

  // Rapor yaşam döngüsünden BAĞIMSIZ (bkz. milestone Plan notları) - mute
  // Report.status'a hiç dokunmuyor, ModerationController'daki "sustur"
  // butonu her zaman tıklanabilir kalıyor. Tekrar mute mutedUntil'i
  // DEĞİŞTİRİR (stack/uzatmaz) - basit "şu anki durum" modeli.
  async applyMute(
    moderatorId: string,
    targetUserId: string,
    durationHours: number,
  ): Promise<{ mutedUntil: Date }> {
    await this.findUserOrThrow(targetUserId);
    const mutedUntil = new Date(Date.now() + durationHours * HOUR_IN_MS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { mutedUntil },
      }),
      this.prisma.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: MUTE_APPLIED_ACTION,
          targetUserId,
        },
      }),
    ]);

    return { mutedUntil };
  }

  // Zaten susturulmamış birini unmute etmek zararsız bir no-op - yine de
  // MUTE_LIFTED denetim satırı yazılır (tutarlı denetim izi, özel durum
  // kodu gerekmiyor).
  async liftMute(moderatorId: string, targetUserId: string): Promise<void> {
    await this.findUserOrThrow(targetUserId);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { mutedUntil: null },
      }),
      this.prisma.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: MUTE_LIFTED_ACTION,
          targetUserId,
        },
      }),
    ]);
  }

  private async findUserOrThrow(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Kullanıcı bulunamadı: ${userId}`);
    }
  }
}
