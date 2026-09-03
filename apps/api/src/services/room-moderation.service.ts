import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';
import {
  RoomSummary,
  ROOM_SUMMARY_SELECT,
  isUniqueConstraintError,
  toRoomSummary,
} from './rooms.service';
import { hasExcessiveCombiningMarks } from './content-validation.util';
import { ROOM_NAME_TAKEN_CODE } from './error-codes.constants';

export const ROOM_RENAMED_ACTION = 'ROOM_RENAMED';
export const ROOM_ARCHIVED_ACTION = 'ROOM_ARCHIVED';
export const ROOM_DELETED_ACTION = 'ROOM_DELETED';
// M7b Slice H2: set VE clear için TEK actionType -
// notifyModeratorRoleChanged'ın "assign VE revoke için TEK metod" emsaliyle
// aynı, targetRoomAnnouncement'ın null/dolu olması hangisi olduğunu zaten
// söylüyor.
export const ROOM_ANNOUNCEMENT_UPDATED_ACTION = 'ROOM_ANNOUNCEMENT_UPDATED';

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
      throw new ConflictException({
        code: ROOM_NAME_TAKEN_CODE,
        message: 'Bu isimde bir oda zaten var.',
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
          where: { id: roomId },
          data: { name: newName },
          select: ROOM_SUMMARY_SELECT,
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
        return toRoomSummary(updated);
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'name')) {
        throw new ConflictException({
          code: ROOM_NAME_TAKEN_CODE,
          message: 'Bu isimde bir oda zaten var.',
        });
      }
      throw error;
    }
  }

  async archiveRoom(moderatorId: string, roomId: string): Promise<RoomSummary> {
    const room = await this.findRoomOrThrow(roomId);
    this.assertNotCoreRoom(room.name);
    if (room.status !== 'active') {
      throw new ConflictException({
        code: 'ROOM_NOT_ACTIVE',
        message: 'Sadece aktif bir oda arşivlenebilir.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id: roomId },
        data: { status: 'archived', archivedAt: new Date() },
        select: ROOM_SUMMARY_SELECT,
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
      return toRoomSummary(updated);
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
      throw new ConflictException({
        code: 'ROOM_NOT_ARCHIVED',
        message: 'Sadece arşivlenmiş bir oda silinebilir - önce arşivle.',
      });
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

  // rename/archive/delete'in aksine assertNotCoreRoom KULLANMIYOR (BİLEREK)
  // - çekirdek odalar (general/meta) tam da founder'ın Faz 1
  // duyurusunu/karşılama mesajını pinleyeceği yerler, oradaki "yapısal
  // odaları koru" gerekçesi burada geçerli değil. Durum kısıtı da yok -
  // rename gibi, hem active hem archived odaya duyuru konabilir.
  async setRoomAnnouncement(
    moderatorId: string,
    roomId: string,
    announcement: string | undefined,
  ): Promise<RoomSummary> {
    const room = await this.findRoomOrThrow(roomId);
    const normalized = announcement?.trim() || null;

    // Mesaj içeriğiyle AYNI koruma (content-validation.util.ts, M7b Slice E)
    // - HERKESE broadcast edilen bir metin, burası kontrolsüz bırakılırsa
    // zalgo korumasını bypass eden bir yan kapı olurdu.
    if (normalized && hasExcessiveCombiningMarks(normalized)) {
      throw new BadRequestException({
        code: 'ANNOUNCEMENT_INVALID_CHARACTERS',
        message: 'Duyuru geçersiz karakterler içeriyor.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id: roomId },
        data: { announcement: normalized },
        select: ROOM_SUMMARY_SELECT,
      });
      await tx.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: ROOM_ANNOUNCEMENT_UPDATED_ACTION,
          targetRoomId: roomId,
          targetRoomName: room.name,
          targetRoomDescription: room.description,
          targetRoomAnnouncement: normalized,
        },
      });
      return toRoomSummary(updated);
    });
  }

  private async findRoomOrThrow(roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Oda bulunamadı: ${roomId}`,
      });
    }
    return room;
  }

  private assertNotCoreRoom(name: string): void {
    if ((CORE_ROOM_NAMES as readonly string[]).includes(name)) {
      throw new ForbiddenException({
        code: 'CORE_ROOM_ACTION_FORBIDDEN',
        message: 'Çekirdek odalar üzerinde bu işlem yapılamaz.',
      });
    }
  }
}
