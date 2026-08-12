import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export interface UserExportDto {
  profile: {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
    role: string;
    emailVerifiedAt: Date | null;
    totalXp: number;
    level: number;
    termsAcceptedAt: Date | null;
  };
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    roomName: string;
  }>;
  invites: Array<{
    code: string;
    createdAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  }>;
  reputationEvents: Array<{
    actionType: string;
    amount: number;
    createdAt: Date;
  }>;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  // M6 Slice G (docs/BACKLOG.md A8, KVKK/GDPR veri taşınabilirliği): minimal
  // bir dışa aktarma - passwordHash/totpSecret/inviterId/usedById gibi
  // kimlik doğrulama sırları ya da başka bir kullanıcının kimliğini
  // sızdıran alanlar BİLEREK dışarıda bırakılıyor (InvitesService.listInvites
  // ile aynı gizlilik kararı).
  async exportUserData(userId: string): Promise<UserExportDto> {
    const [user, messages, invites, reputationEvents] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.message.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        include: { room: { select: { name: true } } },
      }),
      this.prisma.invite.findMany({
        where: { issuedById: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reputationEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        totalXp: user.totalXp,
        level: user.level,
        termsAcceptedAt: user.termsAcceptedAt,
      },
      // Bir oda hard-delete edilince ona ait TÜM mesajlar da AYNI
      // transaction'da siliniyor (rooms.service.ts, Message.roomId'nin
      // ON DELETE RESTRICT kısıtını karşılamak için) - yani burada dönen
      // hiçbir satırın room'u null OLAMAZ, sarkan bir roomId mimari
      // olarak imkansız.
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        roomName: message.room.name,
      })),
      invites: invites.map((invite) => ({
        code: invite.code,
        createdAt: invite.createdAt,
        usedAt: invite.usedAt,
        revokedAt: invite.revokedAt,
      })),
      reputationEvents: reputationEvents.map((event) => ({
        actionType: event.actionType,
        amount: event.amount,
        createdAt: event.createdAt,
      })),
    };
  }
}
