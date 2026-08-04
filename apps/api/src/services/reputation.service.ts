import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const XP_PER_LEVEL = 35;
export const MESSAGE_SENT_XP = 1;
export const MESSAGE_SENT_ACTION = 'MESSAGE_SENT';

export interface AwardXpResult {
  oldLevel: number;
  newLevel: number;
}

// Saf fonksiyon, DI gerektirmiyor - isUniqueConstraintError'ın (rooms.service.ts)
// kurduğu "state'siz mantık class dışında yaşar" deseniyle aynı. xpPerLevel'in
// parametre olması replay testinin kalbi: aynı totalXp, farklı bir eşikle
// tekrar hesaplanınca depolanan hiçbir toplama dokunmadan farklı (düzeltilmiş)
// bir seviye üretiyor - ADR-0004'ün "günlük yeniden oynatılabilir" iddiasının
// kanıtı.
export function computeLevelFromXp(
  totalXp: number,
  xpPerLevel: number = XP_PER_LEVEL,
): number {
  return Math.floor(totalXp / xpPerLevel);
}

// SocketRegistryService gibi bağımlılıksız bir servis - awardXp kendi
// transaction'ını AÇMIYOR, çağıranın açık tx'ini alıyor (MessagesService.
// sendMessage'ın zaten var olan transaction'ına komponse olabilsin diye -
// mesaj + Room.lastActivityAt + XP tek atomik yazma).
@Injectable()
export class ReputationService {
  async awardXp(
    tx: Prisma.TransactionClient,
    userId: string,
    actionType: string,
    amount: number,
    sourceMessageId?: string,
  ): Promise<AwardXpResult> {
    await tx.reputationEvent.create({
      data: { userId, actionType, amount, sourceMessageId },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: { totalXp: { increment: amount } },
      select: { totalXp: true, level: true },
    });

    const oldLevel = updated.level;
    const newLevel = computeLevelFromXp(updated.totalXp);
    if (newLevel !== oldLevel) {
      await tx.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });
    }

    return { oldLevel, newLevel };
  }
}
