import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invite, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { INVITE_NO_LONGER_VALID_CODE } from './error-codes.constants';

const INVITE_CODE_BYTES = 12;

export interface InviteSummary {
  code: string;
  createdAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

function generateInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString('base64url');
}

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async findRedeemableInvite(code: string): Promise<Invite> {
    const invite = await this.prisma.invite.findUnique({ where: { code } });

    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Davet kodu bulunamadı.',
      });
    }
    if (invite.usedAt) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_USED',
        message: 'Bu davet kodu zaten kullanılmış.',
      });
    }
    // M5 Slice E: revoke edilmiş bir davet - bu kontrol olmadan davetçi
    // hesap verebilirliği mekaniği işe yaramaz (revoke edilmiş bir kod
    // hâlâ redeem edilebilir olurdu).
    if (invite.revokedAt) {
      throw new ConflictException({
        code: INVITE_NO_LONGER_VALID_CODE,
        message: 'Bu davet kodu artık geçerli değil.',
      });
    }

    return invite;
  }

  // M4 Slice B: manuel oluşturma kaldırıldı, davetler artık sadece seviye
  // atlayınca kazanılıyor - MessagesService.sendMessage'ın transaction'ına
  // komponse olabilsin diye (awardXp'yle aynı desen) çağıranın açık tx'ini
  // alıyor. Kodlar önce uygulama tarafında üretilir, sonra TEK bir
  // createMany ile yazılır - bir döngüde N ayrı create() paylaşılan Room
  // satır kilidini (aynı transaction'da) N round-trip kadar uzatırdı.
  //
  // M5 Slice E: kazanılan davetler önce pendingInviteDebt'i (davetçi hesap
  // verebilirliği borcu) karşılar, kalan (varsa) gerçek Invite satırı
  // olarak yazılır - kullanılmamış daveti olmadığı için susturma anında
  // ceza uygulanamayan bir davetçi, bir sonraki kazanımında bunu öder.
  async grantInvites(
    tx: Prisma.TransactionClient,
    issuedById: string,
    count: number,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: issuedById },
      select: { pendingInviteDebt: true },
    });
    const debt = user?.pendingInviteDebt ?? 0;
    const offset = Math.min(debt, count);
    const grantCount = count - offset;

    if (offset > 0) {
      await tx.user.update({
        where: { id: issuedById },
        data: { pendingInviteDebt: { decrement: offset } },
      });
    }
    if (grantCount > 0) {
      const codes = Array.from({ length: grantCount }, generateInviteCode);
      await tx.invite.createMany({
        data: codes.map((code) => ({ code, issuedById })),
      });
    }
  }

  // M5 Slice E: davetçi hesap verebilirliği (B15) - MutesService.applyMute
  // tarafından, susturulan kullanıcının davetçisi için çağrılır. Öncelik
  // KULLANILMAMIŞ bir davetin hemen revoke edilmesi ("kota düşer",
  // BACKLOG B15'in kendi metni); kullanılmamış davet yoksa borç
  // biriktirilir (bkz. grantInvites) - en çok davet eden, dolayısıyla en
  // riskli kullanıcının elinde revoke edilecek bir davet hiç
  // bulunmayabileceği için bu alan olmadan mekanik tam da orada etkisiz
  // kalırdı.
  async applyInviterConsequence(
    tx: Prisma.TransactionClient,
    issuedById: string,
  ): Promise<{ revokedInviteId: string | null; debtIncurred: boolean }> {
    const invite = await tx.invite.findFirst({
      where: { issuedById, usedAt: null, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (invite) {
      // auth.service.ts'in signup "claim" adımıyla AYNI desen - findFirst
      // ile update arasında aynı davetin başka bir yerden (eşzamanlı bir
      // signup YA DA eşzamanlı ikinci bir applyMute) claim/revoke
      // edilmesi TOCTOU'sunu updateMany + count kontrolü kapatıyor.
      const result = await tx.invite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count > 0) {
        return { revokedInviteId: invite.id, debtIncurred: false };
      }
    }

    await tx.user.update({
      where: { id: issuedById },
      data: { pendingInviteDebt: { increment: 1 } },
    });
    return { revokedInviteId: null, debtIncurred: true };
  }

  // usedById/redeemer kimliği bilerek DTO'ya dahil edilmiyor - kimin kimi
  // davet ettiğini bugün geri okuyan hiçbir uç nokta yok (inviterId sadece
  // auth.service.ts'te bir kez yazılıyor), bu yüzden bu "zaten görünen bir
  // bilgiyi tekrarlamama" değil, yeni bir gizlilik kararı.
  async listInvites(issuedById: string): Promise<InviteSummary[]> {
    const invites = await this.prisma.invite.findMany({
      where: { issuedById },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => ({
      code: invite.code,
      createdAt: invite.createdAt,
      usedAt: invite.usedAt,
      revokedAt: invite.revokedAt,
    }));
  }
}
