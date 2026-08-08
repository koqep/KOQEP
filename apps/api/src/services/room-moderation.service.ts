import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';
import { RoomSummary, isUniqueConstraintError } from './rooms.service';

export const ROOM_RENAMED_ACTION = 'ROOM_RENAMED';
export const ROOM_ARCHIVED_ACTION = 'ROOM_ARCHIVED';
export const ROOM_DELETED_ACTION = 'ROOM_DELETED';

const roomSummarySelect = {
  id: true,
  name: true,
  description: true,
  lastActivityAt: true,
  status: true,
} as const;

@Injectable()
export class RoomModerationService {
  constructor(private readonly prisma: PrismaService) {}

  // Rename hiçbir zaman status'a dokunmuyor - ADR-0006'nın tek-yönlü
  // FSM'iyle (active -> archived -> deleted) hiçbir çakışması yok
  // (archive/delete'in aksine), bu yüzden BİLEREK durum kısıtı yok: hem
  // active hem archived bir oda yeniden adlandırılabilir.
  async renameRoom(
    moderatorId: string,
    roomId: string,
    newName: string,
  ): Promise<RoomSummary> {
    const room = await this.findRoomOrThrow(roomId);
    this.assertNotCoreRoom(room.name);

    // createRoom'un case-insensitive ön-kontrolü ile AYNI desen, ama
    // id: { not: roomId } ile kendi mevcut satırını hariç tutuyor - yoksa
    // bir odayı sadece büyük/küçük harf düzeltmek için yeniden adlandırmak
    // kendi satırıyla çakışıp yanlışlıkla ConflictException atardı.
    const existingRoom = await this.prisma.room.findFirst({
      where: {
        name: { equals: newName, mode: 'insensitive' },
        id: { not: roomId },
      },
    });
    if (existingRoom) {
      throw new ConflictException('Bu isimde bir oda zaten var.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
          where: { id: roomId },
          data: { name: newName },
          select: roomSummarySelect,
        });
        await tx.moderationAuditLog.create({
          data: {
            moderatorId,
            actionType: ROOM_RENAMED_ACTION,
            targetRoomId: roomId,
            targetRoomName: room.name,
            targetRoomDescription: room.description,
          },
        });
        return updated;
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'name')) {
        throw new ConflictException('Bu isimde bir oda zaten var.');
      }
      throw error;
    }
  }

  async archiveRoom(moderatorId: string, roomId: string): Promise<RoomSummary> {
    const room = await this.findRoomOrThrow(roomId);
    this.assertNotCoreRoom(room.name);
    if (room.status !== 'active') {
      throw new ConflictException('Sadece aktif bir oda arşivlenebilir.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id: roomId },
        data: { status: 'archived', archivedAt: new Date() },
        select: roomSummarySelect,
      });
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: ROOM_ARCHIVED_ACTION,
          targetRoomId: roomId,
          targetRoomName: room.name,
          targetRoomDescription: room.description,
        },
      });
      return updated;
    });
  }

  // ADR-0006'nın tek-yönlü FSM'ini atlamamak için SADECE zaten arşivlenmiş
  // bir oda silinebilir - aktif kötüye kullanılan bir oda için moderatör
  // önce archiveRoom, sonra deleteRoom çağırır (iki tık, hiçbir durum
  // atlanmıyor).
  async deleteRoom(
    moderatorId: string,
    roomId: string,
  ): Promise<{ deletedMessageCount: number }> {
    const room = await this.findRoomOrThrow(roomId);
    this.assertNotCoreRoom(room.name);
    if (room.status !== 'archived') {
      throw new ConflictException(
        'Sadece arşivlenmiş bir oda silinebilir - önce arşivle.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Bu odadaki mesajlara ait AÇIK raporlar mesajlar silinmeden ÖNCE
      // (ilişki hâlâ geçerliyken) çözüldü olarak kapatılıyor - yoksa
      // messageId null'a düşer, rapor sonsuza kadar 'open' kalır ve
      // moderatör "içeriği kaldır" diyemez (hayalet rapor). Her kapatılan
      // rapor için ayrı bir denetim satırı YAZILMIYOR - tek ROOM_DELETED
      // satırı bu toplu kapanışın nedenini zaten açıklıyor
      // (REPORT_QUEUE_VIEWED'in granülerlik kararıyla aynı gerekçe).
      await tx.report.updateMany({
        where: { message: { roomId }, status: 'open' },
        data: {
          status: 'resolved',
          resolvedById: moderatorId,
          resolvedAt: new Date(),
        },
      });

      // Child->parent sırası zorunlu (RESTRICT FK'ler) - purgeArchivedRooms
      // ile AYNI sıra.
      await tx.messageEdit.deleteMany({
        where: { message: { roomId } },
      });
      const { count: deletedMessageCount } = await tx.message.deleteMany({
        where: { roomId },
      });

      // Odayı silmeden ÖNCE yazılıyor - TERSİ sıra çalışmaz (targetRoomId
      // zaten-silinmiş bir satıra işaret edip FK ihlaliyle patlardı).
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: ROOM_DELETED_ACTION,
          targetRoomId: roomId,
          targetRoomName: room.name,
          targetRoomDescription: room.description,
          deletedMessageCount,
        },
      });

      await tx.room.delete({ where: { id: roomId } });

      return { deletedMessageCount };
    });
  }

  private async findRoomOrThrow(roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(`Oda bulunamadı: ${roomId}`);
    }
    return room;
  }

  private assertNotCoreRoom(name: string): void {
    if ((CORE_ROOM_NAMES as readonly string[]).includes(name)) {
      throw new ForbiddenException(
        'Çekirdek odalar üzerinde bu işlem yapılamaz.',
      );
    }
  }
}
