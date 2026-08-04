import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invite, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';

const INVITE_CODE_BYTES = 12;

export interface InviteSummary {
  code: string;
  createdAt: Date;
  usedAt: Date | null;
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
      throw new NotFoundException('Davet kodu bulunamadı.');
    }
    if (invite.usedAt) {
      throw new ConflictException('Bu davet kodu zaten kullanılmış.');
    }

    return invite;
  }

  // M4 Slice B: manuel oluşturma kaldırıldı, davetler artık sadece seviye
  // atlayınca kazanılıyor - MessagesService.sendMessage'ın transaction'ına
  // komponse olabilsin diye (awardXp'yle aynı desen) çağıranın açık tx'ini
  // alıyor. Kodlar önce uygulama tarafında üretilir, sonra TEK bir
  // createMany ile yazılır - bir döngüde N ayrı create() paylaşılan Room
  // satır kilidini (aynı transaction'da) N round-trip kadar uzatırdı.
  async grantInvites(
    tx: Prisma.TransactionClient,
    issuedById: string,
    count: number,
  ): Promise<void> {
    const codes = Array.from({ length: count }, generateInviteCode);
    await tx.invite.createMany({
      data: codes.map((code) => ({ code, issuedById })),
    });
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
    }));
  }
}
