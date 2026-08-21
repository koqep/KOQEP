import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { InvitesService } from './invites.service';

export const MUTE_APPLIED_ACTION = 'MUTE_APPLIED';
export const MUTE_LIFTED_ACTION = 'MUTE_LIFTED';
// M5 Slice E: davetçi hesap verebilirliği (B15) - InvitesService.
// applyInviterConsequence'ın sonucuna göre yazılır.
export const INVITER_INVITE_REVOKED_ACTION = 'INVITER_INVITE_REVOKED';
export const INVITER_INVITE_DEBT_INCURRED_ACTION =
  'INVITER_INVITE_DEBT_INCURRED';

const HOUR_IN_MS = 60 * 60 * 1000;

@Injectable()
export class MutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitesService: InvitesService,
  ) {}

  // Rapor yaşam döngüsünden BAĞIMSIZ (bkz. milestone Plan notları) - mute
  // Report.status'a hiç dokunmuyor, ModerationController'daki "sustur"
  // butonu her zaman tıklanabilir kalıyor. Tekrar mute mutedUntil'i
  // DEĞİŞTİRİR (stack/uzatmaz) - basit "şu anki durum" modeli.
  async applyMute(
    moderatorId: string,
    targetUserId: string,
    durationHours: number,
    reason: string,
  ): Promise<{ mutedUntil: Date }> {
    const target = await this.findUserOrThrow(targetUserId);
    // M5 Slice E: davetçi hesap verebilirliği SADECE susturulmamıştan
    // susturulmuşa GERÇEK bir geçişte tetiklenir - moderatör aynı kişiyi
    // (ör. süreyi düzeltmek için) art arda iki kez mute ederse bu, AYNI
    // süregelen olay, davetçi iki kez cezalandırılmamalı.
    const wasAlreadyMuted =
      target.mutedUntil !== null && target.mutedUntil > new Date();
    const mutedUntil = new Date(Date.now() + durationHours * HOUR_IN_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { mutedUntil, muteReason: reason },
      });
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: MUTE_APPLIED_ACTION,
          targetUserId,
          reason,
        },
      });

      if (!wasAlreadyMuted && target.inviterId) {
        const { revokedInviteId, debtIncurred } =
          await this.invitesService.applyInviterConsequence(
            tx,
            target.inviterId,
          );
        // moderatorId BİLEREK BURAYA YAZILMIYOR - bu alan kod tabanı
        // genelinde "bu satırı doğrudan tetikleyen moderatör" anlamına
        // geliyor (MUTE_APPLIED, CONTENT_REMOVED, ROOM_DELETED, ... hepsi
        // gerçek bir tıklama). Bu iki aksiyon OTOMATİK bir sonuç - null
        // bırakmak, alanın anlamını genişletip belirsizleştirmek yerine
        // veri seviyesinde "otomatik" olduğunu okunabilir kılıyor. Hangi
        // moderatörün mute'unun tetiklediği, aynı transaction'ın zaman
        // damgasıyla (bu satırla MUTE_APPLIED satırının createdAt'i
        // pratikte aynı) yaklaşık olarak izlenebilir - tam bir nedensellik
        // FK'si bu ölçekte fazla mühendislik.
        if (revokedInviteId) {
          await tx.moderationAuditLog.create({
            data: {
              actionType: INVITER_INVITE_REVOKED_ACTION,
              targetUserId: target.inviterId,
              targetInviteId: revokedInviteId,
            },
          });
        } else if (debtIncurred) {
          await tx.moderationAuditLog.create({
            data: {
              actionType: INVITER_INVITE_DEBT_INCURRED_ACTION,
              targetUserId: target.inviterId,
            },
          });
        }
      }
    });

    return { mutedUntil };
  }

  // Zaten susturulmamış birini unmute etmek zararsız bir no-op - yine de
  // MUTE_LIFTED denetim satırı yazılır (tutarlı denetim izi, özel durum
  // kodu gerekmiyor). Davetçiye uygulanan sonucu (revoke/borç) GERİ
  // VERMİYOR - Slice A'nın içerik-kaldırma-geri-alınamaz emsaliyle aynı
  // ilke (nadir hata senaryosu için gerekirse manuel SQL).
  async liftMute(moderatorId: string, targetUserId: string): Promise<void> {
    await this.findUserOrThrow(targetUserId);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { mutedUntil: null, muteReason: null },
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

  private async findUserOrThrow(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Kullanıcı bulunamadı: ${userId}`);
    }
    return user;
  }
}
